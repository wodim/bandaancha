Object.extend(Controller.prototype, {
    whois: function () {
        document.forms.whois.validator = new Validator(document.forms.whois);
        with(document.forms.whois) {
            validator.validates(input, _("Ip, bloque o dominio"), {
                format: "text"
            })
        }
        Field.activate(document.forms.whois.input)
    },
    ipGeolocation: function () {
        document.forms.ipGeolocation.validator = new Validator(document.forms.ipGeolocation);
        with(document.forms.ipGeolocation) {
            validator.validates(ip, _("Ip"), {
                format: /^(?:\d{1,3})\.(?:\d{1,3})\.(?:\d{1,3})\.(?:\d{1,3})$/
            }, function (error) {
                var result = true;
                var ipValue = ip.value.strip();
                var overflowRange = ipValue.split(".").detect(function (p) {
                    return parseInt(p) < 256 || p == "*" ? false : p
                });
                if (overflowRange) {
                    error("El rango " + overflowRange + " no es válido");
                    return false
                }
                return true
            })
        }
        Field.activate(document.forms.ipGeolocation.ip)
    },
    exchange: function () {
        if (this.request.get()) {
            document.forms.exchange.validator = new Validator(document.forms.exchange);
            with(document.forms.exchange) {
                validator.validates(phone, "Teléfono o código postal", {
                    length: {
                        min: 4,
                        max: 12
                    },
                    format: /^\d[\.\d ]+\d$/
                }, function (error) {
                    var value = parseInt(phone.value.strip().replace(/[\. ]/g, ""));
                    if (value > 99999 && value < 99999999) {
                        error("El teléfono " + phone.value + " no es válido");
                        return false
                    }
                    return true
                });
                Field.activate(phone)
            }
        }
    },
    wifiKeyGenerator: function () {
        new View.Controls.WiFiKeyGenerator()
    },
    tcpIpAnalyzer: function () {}
});
View.Controls.TcpIpAnalyzer = Class.create({
    initialize: function (f, d) {
        this.div = document.getElementById("tcpIpAnalyzer");
        this.div.innerHTML = "";
        if (f.length) {
            this.div.appendChild(document.createTextNode("Selecciona opcionalmente tu conexión y pulsa Iniciar "));
            var g = new Element("select", {
                id: "speed",
                "class": "optional"
            });
            g.add(new Option("Genérica", ""), null);
            for (var e = 0, a = f.length; e < a; e++) {
                var b = new Option(f[e][0], f[e][1]);
                g.add(b, null);
                if (f[e][1] == d) {
                    b.selected = true
                }
            }
            this.div.appendChild(g);
            this.div.appendChild(document.createTextNode(" "))
        }
        var c = new Element("button", {
            type: "button"
        }).update("Iniciar");
        Event.observe(c, "click", this.onClickButton.bind(this));
        this.div.appendChild(c)
    },
    onClickButton: function () {
        var a = {
            authenticity_token: controller.authenticity_token
        };
        var b = document.getElementById("speed");
        if (b && b.value) {
            a.speed = b.value
        }
        new Ajax.Request(controller.urlFor({}), {
            parameters: a,
            onSuccess: function (d, c) {
                if (c.result) {
                    this.div.innerHTML = d.responseText
                } else {
                    alert(c.message)
                }
            }.bind(this),
            onFailure: function (c) {
                alert("Se ha producido un error al enviar la información. Inténtalo de nuevo." + c.responseText)
            }
        });
        setTimeout(this.step2.bind(this), 2000)
    },
    step2: function () {
        new Element("img", {
            src: "http://" + location.hostname + ":8765/bandaancha.eu.png?" + Math.round(Math.random() * 99999)
        })
    }
});
View.Controls.WiFiKeyGenerator = Class.create({
    initialize: function () {
        this.form = document.forms.wifiKeyGenerator;
        new View.Controls.Form(this.form);
        with(document.forms.wifiKeyGenerator) {}
        this.button = this.form.select('button[type="submit"]')[0];
        Event.observe(this.button, "click", this.onSubmit.bind(this))
    },
    onSubmit: function (a) {
        Event.stop(a || window.event);
        this.generate()
    },
    generate: function () {
        var e = "";
        if (this.form.numbers.checked) {
            for (var c = 0; c <= 9; c++) {
                e += c.toString()
            }
        }
        if (this.form.uppercase.checked) {
            for (var c = 65; c <= 90; c++) {
                e += String.fromCharCode(c)
            }
        }
        if (this.form.lowercase.checked) {
            for (var c = 97; c <= 122; c++) {
                e += String.fromCharCode(c)
            }
        }
        if (this.form.symbols.checked) {
            for (var c = 33; c <= 47; c++) {
                e += String.fromCharCode(c)
            }
            for (var c = 58; c <= 64; c++) {
                e += String.fromCharCode(c)
            }
            for (var c = 91; c <= 96; c++) {
                e += String.fromCharCode(c)
            }
            for (var c = 123; c <= 126; c++) {
                e += String.fromCharCode(c)
            }
        }
        if (this.form.spaces.checked) {
            e += " "
        }
        var f = e.length;
        var a;
        for (var c = 0; c < this.form.type.length; c++) {
            if (this.form.type[c].checked) {
                a = parseInt(this.form.type[c].value.substr(3)) / 8;
                break
            }
        }
        var b = "";
        for (var c = 0; c < a; c++) {
            b += e.charAt(Math.floor(Math.random() * f))
        }
        if (this.form.format[1].checked) {
            var d = "";
            for (var c = 0; c < a; c++) {
                d += b.charCodeAt(c).toString(16)
            }
            b = d
        }
        this.form.key.value = b
    }
});
View.Controls.GoogleMap.ExchangeMap = Class.create({
    initialize: function (d, b, c, a) {
        this.div = document.getElementById(d);
        this.canEdit = a;
        this.map = new GMap2(this.div);
        this.map.addControl(new GLargeMapControl(), new GControlPosition(google.maps.ANCHOR_TOP_RIGHT, new GSize(10, 10)));
        this.map.setCenter(new GLatLng(b.latitude || View.Controls.GoogleMap.DEFAULT_LATITUDE, b.longitude || View.Controls.GoogleMap.DEFAULT_LONGITUDE), 13);
        this.baseIcon = new GIcon();
        this.baseIcon.image = "/images/tools/gicon-exchange.gif";
        this.baseIcon.iconSize = new GSize(18, 32);
        this.baseIcon.iconAnchor = new GPoint(9, 32);
        this.baseIcon.infoWindowAnchor = new GPoint(9, 6);
        this.updateMarkers(c)
    },
    updateMarkers: function (g) {
        this.map.clearOverlays();
        var a = this.parseData(g);
        for (var d = 0, b = a.length; d < b; d++) {
            var c = a[d];
            var e = new GIcon(this.baseIcon);
            var f = new GMarker(new GLatLng(c.latitude, c.longitude), {
                icon: e,
                draggable: c.geolocation == "auto" ? true : false
            });
            if (c.geolocation == "auto") {
                f.disableDragging()
            }
            c.marker = f;
            c.tabs = this.buildTabs(c);
            this.map.addOverlay(f);
            GEvent.addListener(f, "click", function () {
                f.openInfoWindowTabs(c.tabs)
            }.bind(this));
            GEvent.addListener(f, "dragstart", function () {
                this.map.getInfoWindow().hide()
            }.bind(this));
            GEvent.addListener(f, "dragend", function () {
                f.openInfoWindowTabs(c.tabs);
                setTimeout(function () {
                    this.map.getInfoWindow().selectTab(1)
                }.bind(this), 100)
            }.bind(this));
            if (b == 1) {
                f.openInfoWindowTabs(c.tabs)
            }
        }
    },
    parseData: function (f) {
        var a = [];
        var e = ["id", "name", "kind", "latitude", "longitude", "geolocation", "lines", "adsl_rtb", "adsl_rdsi", "adsl2plus", "vdsl2", "ftth", "s3mbps", "s10_20mbps", "symmetrical", "saturation"];
        for (var d = 0; d < f.length; d++) {
            var b = {};
            for (var c = 0; c < e.length; c++) {
                var g = e[c];
                b[g] = f[d][c];
                switch (g) {
                case "latitude":
                    if (!b[g]) {
                        b[g] = View.Controls.GoogleMap.DEFAULT_LATITUDE
                    }
                    break;
                case "longitude":
                    if (!b[g]) {
                        b[g] = View.Controls.GoogleMap.DEFAULT_LONGITUDE
                    }
                    break
                }
            }
            a.push(b)
        }
        return a
    },
    buildTabs: function (i) {
        var j = [];
        if (i.adsl_rtb) {
            j.push('<img src="/images/tools/adsl_rtb.gif" alt="ADSL" title="ADSL"> ADSL')
        }
        if (i.adsl2plus) {
            j.push('<img src="/images/tools/adsl2plus.gif" alt="ADSL2+" title="ADSL2+"> ADSL2+')
        }
        if (i.vdsl2) {
            var h = "";
            if (typeof i.vdsl2 == "number") {
                h += "<br>"
            }
            h += '<img src="/images/tools/vdsl2.gif" alt="VDSL2" title="VDSL2"> VDSL2';
            var e = new Date(i.vdsl2 * 1000);
            if (typeof i.vdsl2 == "number") {
                h += " previsto para el " + (e.getMonth() + 1) + "/" + e.getFullYear()
            }
            j.push(h)
        }
        if (i.ftth) {
            var h = "";
            if (typeof i.ftth == "number") {
                h += "<br>"
            }
            h += '<img src="/images/tools/ftth.gif" alt="FTTH" title="FTTH"> FTTH';
            var e = new Date(i.ftth * 1000);
            if (typeof i.ftth == "number") {
                h += " previsto para el " + (e.getMonth() + 1) + "/" + e.getFullYear()
            }
            j.push(h)
        }
        var g = [];
        if (i.s3mbps) {
            g.push("3 Mbps")
        }
        if (i.s10_20mbps) {
            g.push("10 y 20 Mbps")
        }
        if (i.symmetrical) {
            g.push("1 y 1,5 Mbps simétricos")
        }
        var d = i.saturation;
        if (d == 0) {
            d = "No admite nuevas líneas de banda ancha"
        } else {
            if (d > 0) {
                d = "No admite nuevas líneas con velocidad superior a " + d.toString().replace(".", ",") + " Mbps"
            } else {
                d = "Ninguna"
            }
        }
        var c = "<dl><dt>Nombre de la central</dt><dd>" + i.name + (i.kind == "node" ? " (nodo remoto)" : "") + "<dd><dt>Nº de líneas a las que presta servicio</dt><dd>" + i.lines + "<dd><dt>Tecnologías</dt><dd>" + j.join(" ") + "<dd><dt>Velocidades</dt><dd>" + g.join(", ") + "<dd><dt>Saturación</dt><dd>" + d + "<dd></dl>";
        var f = [];
        switch (i.geolocation) {
        case "auto":
            c += '<div class="tip">La posición sobre el mapa es PROVISIONAL. Utiliza la pestaña MODIFICAR si crees que es incorrecta.</div>';
            break;
        case "problem":
            c += '<div class="tip">La posición sobre el mapa es ERRÓNEA y esta pendiente de revisión.</div>'
        }
        if (this.canEdit) {
            f.push('<a href="/admin/phones/exchanges/update/' + i.id + '" class="m">Editar</a>')
        }
        if (f[0]) {
            c += '<div class="actions">' + f.join(" ") + "</div>"
        }
        var a = new Element("div", {
            style: "width: 280px; height:220px",
            "class": "infoWindow commentable"
        });
        a.innerHTML = c;
        var k = [new GInfoWindowTab("Datos", a, function (m) {
            this.map.getInfoWindow().selectTab(0);
            if (m.marker.draggable()) {
                m.marker.disableDragging()
            }
        }.bind(this, i))];
        if (i.geolocation == "auto") {
            var a = new Element("div", {
                style: "width: 280px; height:220px",
                "class": "infoWindow commentable"
            });
            a.innerHTML = '<div class="tip">Escribe tus observaciones. Opcionalmente, arrastra la central sobre el mapa para sugerir una nueva ubicación. Pulsa ENVIAR al finalizar.</div><form><textarea>Escribe cualquier indicación que nos ayude a posicionar correctamente la central, como una nueva dirección o las razones por la que crees que esta mal.</textarea></form><div class="actions s"><a href="#" class="u s">Enviar</a></div>';
            k.push(new GInfoWindowTab("Modificar", a, function (m) {
                this.map.getInfoWindow().selectTab(1);
                m.marker.enableDragging()
            }.bind(this, i)));
            i.textarea = a.getElementsByTagName("textarea")[0];
            var b = i.textarea.form;
            b.validator = new Validator(b, false);
            b.validator.validates(i.textarea, "Observaciones", {
                length: {
                    min: 3,
                    max: 256
                }
            });
            i.textarea.onfocus = function () {
                if (!this.initialized) {
                    this.value = "";
                    this.initialized = true
                }
            };
            var l = Element.select(a, "a.s")[0];
            if (l) {
                Event.observe(l, "click", this.onClickSendAnchor.bind(this, i))
            }
        }
        return k
    },
    onClickSendAnchor: function (b, e) {
        var e = e || window.event;
        Event.stop(e);
        if (!b.textarea.initialized) {
            b.textarea.value = ""
        }
        var c = b.textarea.form.validator;
        if (!c.valid()) {
            alert(c.getErrors().join("\n"));
            Field.activate(c.firstWrongField());
            return false
        }
        var d = Event.element(e);
        Element.addClassName(d, "loading");
        var f = {
            id: b.id,
            authenticity_token: controller.authenticity_token,
            observations: b.textarea.value
        };
        var a = b.marker.getLatLng();
        if (b.latitude != a.lat() || b.longitude != a.lng()) {
            f.latitude = a.lat();
            f.longitude = a.lng()
        }
        new Ajax.Request(controller.urlFor({
            action: "mark_exchange"
        }), {
            parameters: f,
            onSuccess: function (i, g) {
                if (g.result) {
                    var h = b.marker;
                    h.disableDragging();
                    h.closeInfoWindow();
                    h.bindInfoWindowTabsHtml(null);
                    b.geolocation = "problem";
                    h.openInfoWindowTabs(this.buildTabs(b));
                    Element.removeClassName(d, "loading");
                    alert("Gracias por la información. La central será revisada próximamente.")
                } else {
                    Element.removeClassName(d, "loading");
                    alert(g.message)
                }
            }.bind(this),
            onFailure: function (g) {
                Element.removeClassName(d, "loading");
                alert("Se ha producido un error al enviar la información. Inténtalo de nuevo." + g.responseText)
            }
        })
    }
});
View.Controls.GoogleMap.IpGeolocationMap = Class.create({
    initialize: function (d, c) {
        this.div = document.getElementById(d);
        this.data = c;
        this.map = new GMap2(this.div);
        this.map.addControl(new GSmallZoomControl(), new GControlPosition(google.maps.ANCHOR_TOP_RIGHT, new GSize(10, 10)));
        var a = new GLatLng(this.data.latitude, this.data.longitude);
        this.map.setCenter(a, 6);
        this.map.addOverlay(new GMarker(a));
        var b = document.createElement("div");
        b.className = "geolocationInfoWindow";
        b.innerHTML = "<h1>" + this.data.ip + "</h1><dl><dt>Nombre de la red<dt><dd>" + this.data.netName + "<dd><dt>Descripción<dt><dd>" + this.data.description.replace("\n", "<br>") + "<dd><dt>Localización<dt><dd>" + this.data.location + "<dd></dl>";
        this.map.openInfoWindow(a, b)
    }
});
View.Controls.GoogleMap.IpInfoMap = Class.create({
    initialize: function (g) {
        this.data = g;
        this.mapDiv = document.getElementById("ipInfoMap");
        this.infoWindowDiv = document.getElementById("infoWindow");
        var c = this.infoWindowDiv.getElementsByTagName("a");
        for (var e = 0, b = c.length; e < b; e++) {
            var d = c[e];
            if (d.href.indexOf("/ban?") != -1) {
                Event.observe(d, "click", this.onClickAnchor.bind(this))
            }
        }
        this.map = new GMap2(this.mapDiv);
        this.map.addControl(new GSmallZoomControl(), new GControlPosition(google.maps.ANCHOR_TOP_RIGHT, new GSize(10, 10)));
        var a = new GLatLng(this.data.latitude || View.Controls.GoogleMap.DEFAULT_LATITUDE, this.data.longitude || View.Controls.GoogleMap.DEFAULT_LONGITUDE);
        this.map.setCenter(a, 6);
        var f = new GMarker(a);
        f.bindInfoWindow(this.infoWindowDiv);
        this.map.addOverlay(f);
        f.openInfoWindow(this.infoWindowDiv)
    },
    onClickAnchor: function (b) {
        var b = b || window.event;
        Event.stop(b);
        var a = Event.element(b);
        if (Element.hasClassName(a, "disabled")) {
            return
        }
        Element.addClassName(a, "loading");
        new Ajax.Request(a.href, {
            parameters: {
                authenticity_token: controller.authenticity_token
            },
            onComplete: function (d, c) {
                Element.removeClassName(a, "loading");
                if (c && !c.result) {
                    alert(c.message);
                    return
                }
                if (!d.request.success()) {
                    alert("Se ha producido un error al enviar el mensaje");
                    return
                }
                a.textContent = c.banned ? a.textContent.replace("Banear", "Desbanear") : a.textContent.replace("Desbanear", "Banear")
            }.bind(this)
        })
    }
});