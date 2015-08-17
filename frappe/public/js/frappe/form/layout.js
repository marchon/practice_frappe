// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt
frappe.provide("frappe.ui.form");

// 	- page
//		- section
//			- column
//		- section


frappe.ui.form.Layout = Class.extend({
	init: function(opts) {
		this.views = {};
		this.pages = [];
		this.sections = [];
		this.fields_list = [];
		this.fields_dict = {};
		this.labelled_section_count = 0;
		this.ignore_types = frappe.model.layout_fields;

		$.extend(this, opts);
	},
	make: function() {
		if(!this.parent && this.body)
			this.parent = this.body;
		this.wrapper = $('<div class="form-layout">').appendTo(this.parent);
		if(!this.fields)
			this.fields = frappe.meta.sort_docfields(frappe.meta.docfield_map[this.doctype]);
		this.setup_tabbing();
		this.render();
	},
	refresh: function(doc) {
		var me = this;
		if(doc) this.doc = doc;

		if (this.frm) {
			this.wrapper.find(".empty-form-alert").remove();
		}

		// NOTE this might seem redundant at first, but it needs to be executed when frm.refresh_fields is called
		me.attach_doc_and_docfields(true);

		if(this.frm && this.frm.wrapper) {
			$(this.frm.wrapper).trigger("refresh-fields");
		}

		// dependent fields
		this.refresh_dependency();

		// refresh sections
		this.refresh_sections();
	},
	show_empty_form_message: function() {
		this.wrapper.find(".empty-form-alert").remove();
		if(!(this.wrapper.find(".frappe-control:visible").length)) {
			$('<div class="empty-form-alert text-muted" style="padding: 15px;">'
				+__("This form does not have any input")+'</div>')
			.appendTo(this.page);
		}
	},
	attach_doc_and_docfields: function(refresh) {
		var me = this;
		for(var i=0, l=this.fields_list.length; i<l; i++) {
			var fieldobj = this.fields_list[i];
			if(me.doc) {
				fieldobj.doc = me.doc;
				fieldobj.doctype = me.doc.doctype;
				fieldobj.docname = me.doc.name;
				fieldobj.df = frappe.meta.get_docfield(me.doc.doctype,
					fieldobj.df.fieldname, me.frm.doc.name);

				// on form change, permissions can change
				fieldobj.perm = me.frm.perm;
			};
			refresh && fieldobj.refresh && fieldobj.refresh();
		}
	},
	render: function() {
		var me = this;


		this.section = null;
		this.column = null;
		if((this.fields[0] && this.fields[0].fieldtype!="Section Break") || !this.fields.length) {
			this.make_section();
		}
		$.each(this.fields, function(i, df) {
			switch(df.fieldtype) {
				case "Fold":
					me.make_page(df);
					break;
				case "Section Break":
					me.make_section(df);
					break;
				case "Column Break":
					me.make_column(df);
					break;
				default:
					me.make_field(df);
			}
		});

	},
	make_field: function(df, colspan) {
		!this.section && this.make_section();
		!this.column && this.make_column();

		var fieldobj = frappe.ui.form.make_control({
			df: df,
			doctype: this.doctype,
			parent: this.column.get(0),
			frm: this.frm
		});

		fieldobj.layout = this;
		this.fields_list.push(fieldobj);
		this.fields_dict[df.fieldname] = fieldobj;
		if(this.frm) {
			fieldobj.perm = this.frm.perm;
		}
	},
	make_page: function(df) {
		var me = this,
			head = $('<div class="form-clickable-section text-center">\
				<a class="btn-fold h6 text-muted">'+__("Show more details")+'</a>\
			</div>').appendTo(this.wrapper);

		this.page = $('<div class="form-page second-page hide"></div>').appendTo(this.wrapper);

		this.fold_btn = head.find(".btn-fold").on("click", function() {
			var page = $(this).parent().next();
			if(page.hasClass("hide")) {
				$(this).removeClass("btn-fold").html(__("Hide details"));
				page.removeClass("hide");
				frappe.ui.scroll($(this), true, 30);
				me.folded = false;
			} else {
				$(this).addClass("btn-fold").html(__("Show more details"));
				page.addClass("hide");
				me.folded = true;
			}
		});

		this.section = null;
		this.folded = true;
	},

	unfold: function() {
		this.fold_btn.trigger('click');
	},

	make_section: function(df) {
		var me = this;
		if(!this.page) {
			this.page = $('<div class="form-page"></div>').appendTo(this.wrapper);
		}

		this.section = $('<div class="row form-section">')
			.appendTo(this.page);
		this.sections.push(this.section);

		var section = this.section[0];
		section.df = df;
		if(df) {
			if(df.label) {
				$('<div class="col-sm-12"><h4 class="form-section-heading">' + __(df.label) + '</h4></div>')
				.appendTo(this.section);
			}
			if(df.description) {
				$('<div class="col-sm-12 small text-muted">' + __(df.description) + '</div>')
				.appendTo(this.section);
			}
			this.fields_dict[df.fieldname] = section;
			this.fields_list.push(section);
		}
		// for bc
		this.section.body = $('<div>').appendTo(this.section);
		// if(this.frm)
		// 	this.section.body.css({"padding":"0px 3%"})
		section.row = {
			wrapper: section
		};
		section.layout = me;
		section.refresh = function() {
			frappe.ui.section_refresh.apply(this);
		}
		this.column = null;
		section.refresh.call(section);
		return this.section;
	},
	make_column: function(df) {
		if(!df) df = {};

		var column = $('<div class="form-column">\
			<form>\
			</form>\
		</div>').appendTo(this.section.body)
			.find("form")
			.on("submit", function() { return false; })

		if(df.label) {
			$('<label class="control-label">'+ __(df.label)
				+'</label>').appendTo(column);
		}

		// distribute all columns equally
		var colspan = cint(12 / this.section.find(".form-column").length);
		this.section.find(".form-column").removeClass()
			.addClass("form-column")
			.addClass("col-sm-" + colspan);

		column.df = df;
		column.layout = this;

		//this.fields_dict[df.fieldname] = column;
		if(df.fieldname) {
			this.fields_list.push(column);
		}

		column.refresh = function() {
			frappe.ui.section_refresh.apply(this);
		}

		this.column = column;
	},
	refresh_sections: function() {
		var cnt = 0;
		this.wrapper.find(".form-section:not(.hide-control)").each(function() {
			var $this = $(this).removeClass("empty-section")
				.removeClass("visible-section")
				.removeClass("shaded-section");
			if(!$(this).find(".frappe-control:not(.hide-control)").length) {
				// nothing visible, hide the section
				$(this).addClass("empty-section");
			} else {
				$(this).addClass("visible-section");
				if(cnt % 2) {
					$(this).addClass("shaded-section");
				}
				cnt ++;
			}
		});
	},
	refresh_section_count: function() {
		this.wrapper.find(".section-count-label:visible").each(function(i) {
			$(this).html(i+1);
		});
	},
	setup_tabbing: function() {
		var me = this;
		this.wrapper.on("keydown", function(ev) {
			if(ev.which==9) {
				var current = $(ev.target),
					doctype = current.attr("data-doctype"),
					fieldname = current.attr("data-fieldname");
				if(doctype)
					return me.handle_tab(doctype, fieldname, ev.shiftKey);
			}
		})
	},
	handle_tab: function(doctype, fieldname, shift) {
		var me = this,
			grid_row = null;
			prev = null,
			fields = me.fields_list,
			in_grid = false;

		// in grid
		if(doctype != me.doctype) {
			grid_row =me.get_open_grid_row()
			fields = grid_row.layout.fields_list;
		}

		for(var i=0, len=fields.length; i < len; i++) {
			if(fields[i].df.fieldname==fieldname) {
				if(shift) {
					if(prev) {
						this.set_focus(prev)
					} else {
						$(this.primary_button).focus();
					}
					break;
				}
				if(i==len-1) {
					// last field in this group
					if(grid_row) {
						// in grid
						if(grid_row.doc.idx==grid_row.grid.grid_rows.length) {
							// last row, close it and find next field
							grid_row.toggle_view(false, function() {
								me.handle_tab(grid_row.grid.df.parent, grid_row.grid.df.fieldname);
							})
						} else {
							// next row
							grid_row.grid.grid_rows[grid_row.doc.idx].toggle_view(true);
						}
					} else {
						$(this.primary_button).focus();
					}
				} else {
					me.focus_on_next_field(i, fields);
				}

				break;
			}
			if(fields[i].disp_status==="Write")
				prev = fields[i];
		}
		return false;
	},
	focus_on_next_field: function(start_idx, fields) {
		// loop to find next eligible fields
		for(var i= start_idx + 1, len = fields.length; i < len; i++) {
			if(fields[i].disp_status==="Write" && !in_list(frappe.model.no_value_type, fields[i].df.fieldtype)) {
				this.set_focus(fields[i]);
				break;
			}
		}
	},
	set_focus: function(field) {
		// next is table, show the table
		if(field.df.fieldtype=="Table") {
			if(!field.grid.grid_rows.length) {
				field.grid.add_new_row(1);
			} else {
				field.grid.grid_rows[0].toggle_view(true);
			}
		}
		else if(field.editor) {
			field.editor.set_focus();
		}
		else if(field.$input) {
			field.$input.focus();
		}
	},
	get_open_grid_row: function() {
		return $(".grid-row-open").data("grid_row");
	},
	refresh_dependency: function() {
		// Resolve "depends_on" and show / hide accordingly
		var me = this;

		var doc = me.doc;
		if (!doc) return;

		var parent = (doc.parent && doc.parenttype && locals[doc.parenttype]) ?
			 locals[doc.parenttype][doc.parent] : {};

		// build dependants' dictionary
		var has_dep = false;

		for(fkey in this.fields_list) {
			var f = this.fields_list[fkey];
			f.dependencies_clear = true;
			if(f.df.depends_on) {
				has_dep = true;
			}
		}

		if(!has_dep)return;

		// show / hide based on values
		for(var i=me.fields_list.length-1;i>=0;i--) {
			var f = me.fields_list[i];
			f.guardian_has_value = true;
			if(f.df.depends_on) {
				// evaluate guardian
				if(f.df.depends_on.substr(0,5)=='eval:') {
					f.guardian_has_value = eval(f.df.depends_on.substr(5));
				} else if(f.df.depends_on.substr(0,3)=='fn:' && me.frm) {
					f.guardian_has_value = me.frm.script_manager.trigger(f.df.depends_on.substr(3), me.doctype, me.docname);
				} else {
					if(!doc[f.df.depends_on]) {
						f.guardian_has_value = false;
					}
				}

				// show / hide
				if(f.guardian_has_value) {
					if(f.df.hidden_due_to_dependency) {
						f.df.hidden_due_to_dependency = false;
						f.refresh();
					}
				} else {
					if(!f.df.hidden_due_to_dependency) {
						f.df.hidden_due_to_dependency = true;
						f.refresh();
					}
				}
			}
		}

		this.refresh_section_count();
	}
});

frappe.ui.section_refresh = function() {
	if(!this.df)
		return;

	// hide if explictly hidden
	var hide = this.df.hidden || this.df.hidden_due_to_dependency;

	// hide if no perm
	if(!hide && this.layout && this.layout.frm && !this.layout.frm.get_perm(this.df.permlevel || 0, "read")) {
		hide = true;
	}

	$(this).toggleClass("hide-control", !!hide);
}
