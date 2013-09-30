Object.extend(Controller.prototype, {
    index: function () {
        new View.Controls.ForumQuickSearch("Buscar en los foros")
    },
    forum: function () {
        var c = $$("article.topic");
        for (var b = 0, a = c.length; b < a; b++) {
            new View.Controls.Post.Comment.Summary(c[b])
        }
        new View.Controls.ForumQuickSearch("Buscar en este foro")
    },
    topic: function () {
        var a = document.getElementById("buttonsBar").getElementsByTagName("a");
        var b = new View.Controls.Post.Comment.Topic(null, $$("li.topic")[0], controller.user ? controller.user.comments_threshold : 0, false, a[0]);
        new View.Controls.ForumQuickSearch("Buscar en este tema");
        a[1].onclick = function (c) {
            Event.stop(c || window.event);
            window.scrollTo(document.viewport.getScrollOffsets().left, 0)
        }
    },
    lastTopics: function () {
        var c = $$("article.topic");
        for (var b = 0, a = c.length; b < a; b++) {
            new View.Controls.Post.Comment.Summary(c[b])
        }
    },
    lastUpdatedTopics: function () {
        var c = $$("article.topic");
        for (var b = 0, a = c.length; b < a; b++) {
            new View.Controls.Post.Comment.Summary(c[b])
        }
    },
    myMessages: function () {
        var c = $$("article.comment");
        for (var b = 0, a = c.length; b < a; b++) {
            new View.Controls.Post.Comment.Summary(c[b])
        }
    },
    search: function () {
        new View.Controls.ForumSearchForm(document.forms.delimit);
        var c = $$("article.comment");
        for (var b = 0, a = c.length; b < a; b++) {
            new View.Controls.Post.Comment.Summary(c[b])
        }
        Form.Element.select(document.forms.delimit.term);
        Form.Element.focus(document.forms.delimit.term)
    },
    reply: function () {
        if (document.forms.reply && document.forms.reply.action.indexOf("/forum/") != -1) {
            var actionsDiv = Element.select(document.forms.reply, "div.actions")[0];
            actionsDiv.innerHTML = "";
            var cancelAnchor = new Element("a", {
                "class": "u"
            });
            cancelAnchor.appendChild(document.createTextNode("Cancelar"));
            actionsDiv.appendChild(cancelAnchor);
            actionsDiv.appendChild(document.createTextNode(" "));
            var sendAnchor = new Element("a", {
                "class": "u"
            });
            sendAnchor.appendChild(document.createTextNode("Enviar"));
            actionsDiv.appendChild(sendAnchor);
            Event.observe(cancelAnchor, "click", function () {
                history.back(1)
            }.bind(this));
            Event.observe(sendAnchor, "click", function () {
                this.editor.synchronizeOut();
                if (document.forms.reply.validator.valid()) {
                    document.forms.reply.submit()
                } else {
                    alert(document.forms.reply.validator.getErrors().join("\n"));
                    Field.activate(document.forms.reply.validator.firstWrongField())
                }
            }.bind(this));
            document.forms.reply.validator = new Validator(document.forms.reply, false);
            with(document.forms.reply) {
                validator.validates(title, "Título", {
                    length: {
                        min: 3,
                        max: 128
                    },
                    format: "text"
                });
                validator.validates(content, "Contenido", {
                    length: {
                        min: 3,
                        max: 57344
                    },
                    format: "multiline_text"
                });
                Field.focus(title)
            }
        }
    },
    edit: function () {
        if (document.forms.edit) {
            if (this.request.parameters.model == "forum") {
                new View.Controls.Form(document.forms.edit);
                with(document.forms.edit) {
                    validator.validates(description, "Descripción", {
                        length: {
                            min: 100,
                            max: 160
                        },
                        format: "text"
                    })
                }
            }
        }
    },
    move: function () {
        if (document.forms.moveOut) {
            new View.Controls.Form(document.forms.moveOut);
            with(document.forms.moveOut) {
                validator.validates(forum, "FORUM")
            }
        }
    },
    closeTopics: function (a) {
        for (var b = 0; b < this.topics.length; b++) {
            if (this.topics[b].li != a.li) {
                this.topics[b].close()
            }
        }
    }
});
View.Controls.ForumQuickSearch = Class.create({
    initialize: function (message) {
        this.message = message;
        this.form = document.getElementById("quickSearch");
        Event.observe(this.form, "submit", this.onSubmit.bind(this));
        this.form.validator = new Validator(this.form);
        with(this.form) {
            term.value = this.message;
            validator.validates(term, "Término", {
                length: {
                    min: 3,
                    max: 32
                }
            });
            Event.observe(term, "focus", this.onFocusInput.bind(this));
            Event.observe(term, "keyup", this.onKeyUpInput.bind(this));
            Event.observe(term, "blur", this.onBlurInput.bind(this))
        }
    },
    onFocusInput: function () {
        with(this.form) {
            if (!term.used) {
                term.value = ""
            }
        }
    },
    onKeyUpInput: function () {
        this.form.term.used = true
    },
    onBlurInput: function () {
        with(this.form) {
            if (!term.used) {
                term.value = this.message
            }
        }
    },
    onSubmit: function () {
        with(this.form) {
            if (term.value == this.message) {
                term.value = ""
            }
        }
    }
});
View.Controls.ForumSearchForm = Class.create({
    initialize: function (form) {
        this.form = form;
        this.formWasEmpty = Form.isEmpty(this.form);
        var label = document.createElement("label");
        label.appendChild(document.createElement("br"));
        var button = view.toolButton({
            icon: "/images/ico/undelimit.gif",
            title: "Nueva búsqueda"
        });
        label.appendChild(button);
        Element.insert(Element.up(Element.select(this.form, "button[type=submit]")[0], "label"), {
            after: label
        });
        Event.observe(button, "click", this.onClickUndelimit.bind(this));
        this.form.validator = new Validator(this.form);
        with(this.form) {
            validator.validates(term, "Término", {
                filled: "optional",
                length: {
                    min: 3,
                    max: 32
                },
                format: "text"
            });
            if (this.form.author) {
                validator.validates(author, "Usuario", {
                    filled: "optional",
                    length: {
                        min: 3,
                        max: 16
                    },
                    format: /^[0-9a-z]+[-0-9a-z]{1,14}[0-9a-z]+$/i
                })
            }
            if (this.form.ip) {
                validator.validates(ip, "IP", {
                    filled: "optional",
                    length: {
                        min: 3,
                        max: 45
                    },
                    format: /^[\.\d:a-f]+$/
                })
            }
            if (this.form.footprint) {
                validator.validates(footprint, "Huella", {
                    filled: "optional",
                    format: /^[0-9a-z]{1,13}$/
                })
            }
            Event.observe(term, "keyup", this.onChangeTerm.bind(this));
            Event.observe(forum, "change", this.onChangeForum.bind(this));
            if (this.form.topic) {
                Event.observe(topic, "change", this.onChangeTopic.bind(this))
            }
            Event.observe(term_field, "change", this.onChangeTermField.bind(this));
            Event.observe(post_type, "change", this.onChangePostType.bind(this));
            if (this.form.author) {
                Event.observe(author, "keyup", this.onChangeAuthor.bind(this))
            }
            if (this.form.ip) {
                Event.observe(ip, "keyup", this.onChangeIp.bind(this))
            }
            if (this.form.footprint) {
                Event.observe(footprint, "keyup", this.onChangeFootprint.bind(this))
            }
        }
        this.onChangeTerm();
        this.onChangeForum();
        if (this.form.topic) {
            this.onChangeTopic()
        }
        this.onChangeTermField();
        this.onChangePostType();
        if (this.form.author) {
            this.onChangeAuthor()
        }
        if (this.form.ip) {
            this.onChangeIp()
        }
        if (this.form.footprint) {
            this.onChangeFootprint()
        }
    },
    onClickUndelimit: function (event) {
        with(this.form) {
            if (this.formWasEmpty) {
                Form.reset(this.form)
            } else {
                with(this.form) {
                    term.value = "";
                    forum.selectedIndex = 0;
                    if (this.form.topic) {
                        topic.selectedIndex = 0
                    }
                    term_field.selectedIndex = 0;
                    post_type.selectedIndex = 0;
                    if (this.form.author) {
                        author.value = ""
                    }
                    if (this.form.ip) {
                        ip.value = ""
                    }
                    if (this.form.footprint) {
                        footprint.value = ""
                    }
                }
                submit()
            }
            Event.fire(term, "change");
            Event.fire(term_field, "change");
            Event.fire(post_type, "change");
            Event.fire(forum, "change")
        }
    },
    onChangeTerm: function () {
        with(this.form) {
            term.style.backgroundColor = term.value.strip() ? "" : view.colors.get("disabled")
        }
    },
    onChangeForum: function () {
        with(this.form) {
            forum.style.backgroundColor = forum.selectedIndex ? "" : view.colors.get("disabled")
        }
    },
    onChangeTopic: function () {
        with(this.form) {
            topic.style.backgroundColor = topic.selectedIndex ? "" : view.colors.get("disabled")
        }
    },
    onChangeTermField: function () {
        with(this.form) {
            term_field.style.backgroundColor = term_field.selectedIndex ? "" : view.colors.get("disabled")
        }
    },
    onChangePostType: function () {
        with(this.form) {
            post_type.style.backgroundColor = post_type.selectedIndex ? "" : view.colors.get("disabled")
        }
    },
    onChangeAuthor: function () {
        with(this.form) {
            author.style.backgroundColor = author.value.strip() ? "" : view.colors.get("disabled")
        }
    },
    onChangeIp: function () {
        with(this.form) {
            ip.style.backgroundColor = ip.value.strip() ? "" : view.colors.get("disabled")
        }
    },
    onChangeFootprint: function () {
        with(this.form) {
            footprint.style.backgroundColor = footprint.value.strip() ? "" : view.colors.get("disabled")
        }
    }
});
View.Controls.ForumSelect = Class.create({
    select: null,
    initialize: function (a) {
        this.select = document.getElementsByName(a)[0];
        Event.observe(this.select, "change", this.onChangeSelect.bind(this))
    },
    onChangeSelect: function () {
        if (this.select.selectedIndex > -1 && Element.hasClassName(this.select.options[this.select.selectedIndex], "grey")) {
            alert("El tema ya pertenece al foro seleccionado");
            this.select.selectedIndex = -1
        }
    }
});
View.Controls.NavBar = Class.create({
    initialize: function (b) {
        this.topic = b;
        this.container = document.getElementById("navBar");
        var a = this.container.getElementsByTagName("a");
        this.replyAnchor = a[0];
        Event.observe(this.replyAnchor, "click", this.topic.onClickReplyAnchor.bind(b));
        this.forumsUl = this.container.getElementsByTagName("ul")[0];
        Event.observe(this.forumsUl, "mouseover", this.onMouseOverForumsUl.bind(this));
        Event.observe(this.forumsUl, "mouseout", this.onMouseOutForumsUl.bind(this));
        this.upAnchor = a[1];
        Event.observe(this.upAnchor, "click", this.topic.onClickUp.bind(b))
    },
    onMouseOverForumsUl: function (a) {
        if (this.opened) {
            clearTimeout(this.closeTimeout)
        } else {
            clearTimeout(this.openTimeout);
            this.openTimeout = setTimeout(function () {
                this.opened = true;
                Element.removeClassName(this.forumsUl, "closed");
                Element.addClassName(this.forumsUl, "opened")
            }.bind(this), 250)
        }
    },
    onMouseOutForumsUl: function (a) {
        if (this.opened) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = setTimeout(function () {
                this.opened = false;
                Element.removeClassName(this.forumsUl, "opened");
                Element.addClassName(this.forumsUl, "closed")
            }.bind(this), 250)
        } else {
            clearTimeout(this.openTimeout)
        }
    }
});