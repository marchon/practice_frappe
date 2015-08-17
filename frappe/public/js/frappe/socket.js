frappe.socket = {
    open_tasks: {},
	init: function() {
		if (frappe.boot.disable_async) {
			return;
		}
    	var socketio_server = frappe.boot.dev_server? '//' + document.domain + ':3000' : '//' + document.domain + ':' + window.location.port;
    	frappe.socket.socket = io.connect(socketio_server);
    	frappe.socket.socket.on('msgprint', function(message) {
    	  frappe.msgprint(message)
    	});

    	frappe.socket.setup_listeners();
    	frappe.socket.setup_reconnect();
    	$(document).on('form-load', function(e, frm) {
    		frappe.socket.doc_subscribe(frm.doctype, frm.docname);
    	});

    	$(document).on('form-unload', function(e, frm) {
    		frappe.socket.doc_unsubscribe(frm.doctype, frm.docname);
    	});
    },
    subscribe: function(task_id, opts) {
    	frappe.socket.socket.emit('task_subscribe', task_id);
    	frappe.socket.socket.emit('progress_subscribe', task_id);

    	frappe.socket.open_tasks[task_id] = opts;
    },
	doc_subscribe: function(doctype, docname) {
		frappe.socket.socket.emit('doc_subscribe', doctype, docname);
		frappe.socket.open_doc = {doctype: doctype, docname: docname};
    },
	doc_unsubscribe: function(doctype, docname) {
		frappe.socket.socket.emit('doc_unsubscribe', doctype, docname);
		frappe.socket.open_doc = null;
    },
    setup_listeners: function() {
    	frappe.socket.socket.on('task_status_change', function(data) {
    	  if(data.status==="Running") {
    		frappe.socket.process_response(data, "running");
    	  } else {
    		// failed or finished
    		  frappe.socket.process_response(data, "callback");
    		// delete frappe.socket.open_tasks[data.task_id];
    	  }
    	});
    	frappe.socket.socket.on('task_progress', function(data) {
    	  frappe.socket.process_response(data, "progress");
    	});
    	frappe.socket.socket.on('new_comment', function(comment) {
    		if (frappe.model.docinfo[comment.comment_doctype] && frappe.model.docinfo[comment.comment_doctype][comment.comment_docname]) {
    			var comments = frappe.model.docinfo[comment.comment_doctype][comment.comment_docname].comments
    			var comment_exists = !!$.map(comments, function(x) { return x.name == comment.name? true : undefined}).length
    			if (!comment_exists) {
    				 frappe.model.docinfo[comment.comment_doctype][comment.comment_docname].comments = comments.concat([comment]);
    			}
    		}
    		if (cur_frm.doctype === comment.comment_doctype && cur_frm.docname === comment.comment_docname) {
    				cur_frm.comments.refresh();
    		}
    	});
    	frappe.socket.socket.on('new_message', function(comment) {
    		frappe.utils.notify(__("Message from {0}", [comment.comment_by_fullname]), comment.comment);
    		if ($(cur_page.page).data('page-route') === 'messages') {
    			var current_contact = $(cur_page.page).find('[data-contact]').data('contact');
    			var on_broadcast_page = current_contact === user;
    			if (current_contact == comment.owner || (on_broadcast_page && comment.broadcast)) {
    				var $row = $('<div class="list-row"/>');
    				frappe.desk.pages.messages.list.data.unshift(comment);
    				frappe.desk.pages.messages.list.render_row($row, comment);
    				frappe.desk.pages.messages.list.parent.prepend($row);
    			}
    		}
    		else {
    		}
    	});
    },
    setup_reconnect: function() {
    	// subscribe again to open_tasks
    	frappe.socket.socket.on("connect", function() {
    	    $.each(frappe.socket.open_tasks, function(task_id, opts) {
    	        frappe.socket.subscribe(task_id, opts);
    	    });
    	});

    	if(frappe.socket.open_doc) {
    		frappe.socket.doc_subscribe(frappe.socket.open_doc.doctype, frappe.socket.open_doc.docname);
    	}
    },
    process_response: function(data, method) {
        if(!data) {
            return;
        }

        // success
        if(data) {
            var opts = frappe.socket.open_tasks[data.task_id];
            if(opts[method]) opts[method](data);
        }

        // always
        frappe.request.cleanup(opts, data);
        if(opts.always) {
            opts.always(data);
        }

        // error
        if(data.status_code && data.status_code > 400 && opts.error) {
            opts.error(data);
        }
    }
}

$(frappe.socket.init);
