Object.extend(Controller.prototype, {
    index: function () {},
    read: function () {
        new View.Controls.Post.Commentable.Review($$(".review")[0])
    },
    edit: function () {
        if (document.forms.edit) {
            new View.Controls.Punctuation($$("table.punctuation")[0]);
            new View.Controls.Form(document.forms.edit);
            with(document.forms.edit) {
                validator.validates(speed_id, "Conexión", {}, function (error) {
                    if (Element.hasClassName(speed_id.options[speed_id.selectedIndex], "used")) {
                        return error("No puedes publicar más de un análisis por ISP y modalidad (Si quieres modificar un análisis ves a la sección 'Mis análisis').")
                    }
                    return true
                });
                validator.validates(postal_code, "Código postal", {
                    length: {
                        min: 4,
                        max: 6
                    },
                    format: /^\d{1,2}[^\d]?\d{3}$/,
                    remote: "/reviews/remote_validate_for_postal_code"
                });
                validator.validates(best, "Lo mejor", {
                    length: {
                        min: 3,
                        max: 48
                    },
                    format: /^[^\f\n\r\t\v]+$/
                });
                validator.validates(worst, "Lo peor", {
                    length: {
                        min: 3,
                        max: 48
                    },
                    format: /^[^\f\n\r\t\v]+$/
                });
                validator.validates(p_installation, "Instalación");
                validator.validates(p_price, "Precio");
                validator.validates(p_speed, "Velocidad");
                validator.validates(p_latency, "Latencia");
                validator.validates(p_reliability, "Fiabilidad");
                validator.validates(p_support, "Soporte");
                validator.validates(content, "Contenido", {
                    stripTags: true,
                    length: {
                        min: 3,
                        max: 65536
                    }
                })
            }
        }
    },
    map: function () {}
});
View.Controls.DelimitMapForm = Class.create({
    initialize: function (connectionsData) {
        this.ispsData = {};
        this.technologiesData = {};
        this.speedsData = {};
        this.regionsData = {};
        for (var isp in connectionsData) {
            this.ispsData[isp] = {
                technologies: [],
                speeds: [],
                regions: []
            };
            for (var technology in connectionsData[isp]) {
                this.ispsData[isp].technologies.push(technology);
                if (!this.technologiesData[technology]) {
                    this.technologiesData[technology] = {
                        isps: [],
                        speeds: [],
                        regions: []
                    }
                }
                this.technologiesData[technology].isps.push(isp);
                for (var speed in connectionsData[isp][technology]) {
                    this.ispsData[isp].speeds.push(speed);
                    this.technologiesData[technology].speeds.push(speed);
                    if (!this.speedsData[speed]) {
                        this.speedsData[speed] = {
                            regions: []
                        }
                    }
                    for (var i = 0; i < connectionsData[isp][technology][speed].length; i++) {
                        var region = connectionsData[isp][technology][speed][i];
                        this.ispsData[isp].regions.push(region);
                        this.technologiesData[technology].regions.push(region);
                        this.speedsData[speed].regions.push(region);
                        if (!this.regionsData[region]) {
                            this.regionsData[region] = {
                                isps: [],
                                technologies: [],
                                speeds: []
                            }
                        }
                        this.regionsData[region].isps.push(isp);
                        this.regionsData[region].technologies.push(technology);
                        this.regionsData[region].speeds.push(speed)
                    }
                }
            }
        }
        this.form = document.forms.delimit;
        this.form.validator = new Validator(this.form);
        with(this.form) {
            validator.validates(postal_code, "Código postal", {
                filled: "optional",
                length: {
                    min: 4,
                    max: 6
                },
                format: /^\d{1,2}[^\d]?\d{3}$/,
                remote: "/reviews/remote_validate_for_postal_code"
            });
            validator.validate();
            Event.observe(isp, "change", this.onChangeIsp.bind(this));
            Event.observe(technology, "change", this.onChangeTechnology.bind(this));
            Event.observe(speed, "change", this.onChangeSpeed.bind(this));
            Event.observe(region, "change", this.onChangeRegion.bind(this));
            Event.observe(postal_code, "keyup", this.onChangePostalCode.bind(this))
        }
        this.onChangeIsp(true);
        this.onChangeTechnology(true);
        this.onChangeSpeed(true);
        this.onChangeRegion(true);
        this.onChangePostalCode();
        this.formWasEmpty = Form.isEmpty(this.form);
        this.delimitButton = Element.select(this.form, "button[type=submit]")[0];
        Event.observe(this.delimitButton, "click", this.onClickDelimitButton.bind(this));
        var undelimitButton = Element.select(this.form, "button[type=reset]")[0];
        Event.observe(undelimitButton, "click", this.onClickUndelimitButton.bind(this));
        this.iconsCheckBox = document.getElementsByName("icons");
        for (var i = 0, l = this.iconsCheckBox.length; i < l; i++) {
            Event.observe(this.iconsCheckBox[i], "click", this.onChangeIcon.bind(this))
        }
    },
    onChangeIcon: function () {
        for (var b = 0, a = this.iconsCheckBox.length; b < a; b++) {
            if (this.iconsCheckBox[b].checked) {
                controller.reviewsMap.updateIconType(this.iconsCheckBox[b].value);
                break
            }
        }
    },
    onChangeIsp: function (propagate) {
        with(this.form) {
            isp.style.backgroundColor = isp.selectedIndex ? "" : view.colors.get("disabled")
        }
        if (propagate) {
            this.updateTechnology();
            this.updateSpeed();
            this.updateRegion()
        }
    },
    updateIsp: function () {
        with(this.form) {
            var technologyId = parseInt(technology.options[technology.selectedIndex].value);
            var regionId = parseInt(region.options[region.selectedIndex].value);
            for (var i = 1; i < isp.options.length; i++) {
                var ispId = parseInt(isp.options[i].value);
                var active = this.ispsData[ispId] && (!technologyId || this.ispsData[ispId].technologies.include(technologyId)) && (!regionId || this.ispsData[ispId].regions.include(regionId));
                isp.options[i].style.color = active ? "" : view.colors.get("disabled")
            }
            this.onChangeIsp()
        }
    },
    onChangeTechnology: function (propagate) {
        with(this.form) {
            technology.style.backgroundColor = technology.selectedIndex ? "" : view.colors.get("disabled")
        }
        if (propagate) {
            this.updateIsp();
            this.updateSpeed();
            this.updateRegion()
        }
    },
    updateTechnology: function () {
        with(this.form) {
            var ispId = isp.options[isp.selectedIndex].value;
            var regionId = parseInt(region.options[region.selectedIndex].value);
            for (var i = 1; i < technology.options.length; i++) {
                var technologyId = parseInt(technology.options[i].value);
                var active = this.technologiesData[technologyId] && (!ispId || this.technologiesData[technologyId].isps.include(ispId)) && (!regionId || this.technologiesData[technologyId].regions.include(regionId));
                technology.options[i].style.color = active ? "" : view.colors.get("disabled")
            }
            this.onChangeTechnology()
        }
    },
    onChangeSpeed: function (propagate) {
        with(this.form) {
            speed.style.backgroundColor = speed.selectedIndex ? "" : view.colors.get("disabled")
        }
        if (propagate) {
            this.updateRegion()
        }
    },
    onChangeRegion: function (propagate) {
        with(this.form) {
            region.style.backgroundColor = region.selectedIndex ? "" : view.colors.get("disabled");
            if (region.selectedIndex) {
                if (parseFloat(postal_code.value.strip().substr(0, 2)) != parseInt(region.options[region.selectedIndex].value)) {
                    postal_code.value = "";
                    this.onChangePostalCode()
                }
            }
        }
        if (propagate) {
            this.updateIsp();
            this.updateTechnology();
            this.updateSpeed()
        }
    },
    onChangePostalCode: function () {
        with(this.form) {
            if (postal_code.value.strip()) {
                postal_code.iniColor == undefined ? postal_code.style.backgroundColor = "" : postal_code.iniColor = "";
                if (postal_code.validates.status >= Validator.POSSIBLY_VALID) {
                    Element.enable(radius);
                    var regionId = parseFloat(postal_code.value.strip().substr(0, 2));
                    for (var i = 1; i < region.options.length; i++) {
                        if (parseInt(region.options[i].value) == regionId) {
                            region.selectedIndex = i;
                            this.onChangeRegion(true);
                            break
                        }
                    }
                } else {
                    radius.selectedIndex = 0;
                    Element.disable(radius)
                }
            } else {
                postal_code.iniColor == undefined ? postal_code.style.backgroundColor = view.colors.get("disabled") : postal_code.iniColor = view.colors.get("disabled");
                radius.selectedIndex = 0;
                Element.disable(radius)
            }
        }
    },
    updateSpeed: function () {
        with(this.form) {
            if (isp.selectedIndex && technology.selectedIndex) {
                Element.enable(speed);
                var ispId = parseInt(isp.options[isp.selectedIndex].value);
                var technologyId = parseInt(technology.options[technology.selectedIndex].value);
                var regionId = parseInt(region.options[region.selectedIndex].value);
                for (var i = 1; i < speed.options.length; i++) {
                    var speedId = parseInt(speed.options[i].value);
                    if (this.ispsData[ispId] && this.technologiesData[technologyId] && this.ispsData[ispId].speeds.include(speedId) && this.technologiesData[technologyId].speeds.include(speedId)) {
                        Element.show(speed.options[i]);
                        speed.options[i].style.color = !regionId || this.speedsData[speedId].regions.include(regionId) ? "" : view.colors.get("disabled")
                    } else {
                        Element.hide(speed.options[i])
                    }
                }
            } else {
                speed.selectedIndex = 0;
                Element.disable(speed)
            }
            this.onChangeSpeed()
        }
    },
    updateRegion: function () {
        with(this.form) {
            var ispId = isp.options[isp.selectedIndex].value;
            var technologyId = parseInt(technology.options[technology.selectedIndex].value);
            var speedId = parseInt(speed.options[speed.selectedIndex].value);
            for (var i = 1; i < region.options.length; i++) {
                var regionId = parseInt(region.options[i].value);
                var active = this.regionsData[regionId] && (!ispId || this.regionsData[regionId].isps.include(ispId)) && (!technologyId || this.regionsData[regionId].technologies.include(technologyId)) && (!speedId || this.regionsData[regionId].speeds.include(speedId));
                region.options[i].style.color = active ? "" : view.colors.get("disabled")
            }
            this.onChangeRegion()
        }
    },
    onClickDelimitButton: function (event) {
        with(this.form) {
            if (isp.options[isp.selectedIndex].style.color || technology.options[technology.selectedIndex].style.color || speed.options[speed.selectedIndex].style.color || region.options[region.selectedIndex].style.color) {
                alert("No hay análisis que coincidan con los criterios que has seleccionado");
                Event.stop(event || windows.event);
                return
            }
            this.updateMap()
        }
        Event.stop(event || window.event)
    },
    onClickUndelimitButton: function (event) {
        with(this.form) {
            isp.selectedIndex = 0;
            technology.selectedIndex = 0;
            speed.selectedIndex = 0;
            region.selectedIndex = 0;
            postal_code.value = "";
            radius.selectedIndex = 0;
            this.onChangeIsp(true);
            this.onChangeTechnology(true);
            this.onChangeSpeed(true);
            this.onChangeRegion(true);
            this.onChangePostalCode(true)
        }
        this.updateMap();
        Event.stop(event || window.event)
    },
    updateMap: function () {
        with(this.form) {
            if (Element.hasClassName(this.delimitButton, "loading")) {
                return
            }
            Element.addClassName(this.delimitButton, "loading");
            var parameters = {
                authenticity_token: controller.authenticity_token
            };
            if (isp.selectedIndex) {
                parameters.isp = isp.options[isp.selectedIndex].value
            }
            if (technology.selectedIndex) {
                parameters.technology = technology.options[technology.selectedIndex].value
            }
            if (speed.selectedIndex) {
                parameters.speed = speed.options[speed.selectedIndex].value
            }
            if (region.selectedIndex) {
                parameters.region = region.options[region.selectedIndex].value
            }
            if (postal_code.value.strip()) {
                parameters.postal_code = postal_code.value.strip()
            }
            if (radius.selectedIndex) {
                parameters.radius = radius.options[radius.selectedIndex].value
            }
            new Ajax.Request("/analisis/mapa", {
                parameters: parameters,
                onSuccess: function (request, json) {
                    Element.removeClassName(this.delimitButton, "loading");
                    if (json.result) {
                        controller.reviewsMap.updateData(json.data.items, [json.data.latitude, json.data.longitude], json.data.zoom);
                        if (!json.data.items.length) {
                            alert("No se han encontrado análisis que coincidan con los criterios seleccionados.")
                        }
                    } else {
                        alert(json.message)
                    }
                }.bind(this),
                onFailure: function (request) {
                    Element.removeClassName(this.delimitButton, "loading");
                    alert("AJAX failure" + request.responseText)
                }
            })
        }
    }
});
View.Controls.Punctuation = Class.create();
Object.extend(Object.extend(View.Controls.Punctuation.prototype, View.Controls.Punctuation.prototype), {
    colors: null,
    initialize: function (e) {
        this.colors = {};
        for (var c = 1; c < e.rows[0].cells.length; c++) {
            this.colors[c] = {};
            this.colors[c].active = Element.getStyle(e.rows[0].cells[c], "color")
        }
        for (var c = 1; c < e.rows[1].cells.length; c++) {
            this.colors[c].inactive = Element.getStyle(e.rows[1].cells[c], "backgroundColor")
        }
        for (var c = 1; c < e.rows.length; c++) {
            var d = false;
            for (var b = e.rows[c].cells.length - 1; b > 0; b--) {
                var a = e.rows[c].cells[b].getElementsByTagName("input")[0];
                if (a.checked) {
                    d = this.colors[a.value].active
                }
                e.rows[c].cells[b].style.backgroundColor = d ? d : this.colors[b].inactive
            }
        }
        for (var c = 1; c < e.rows.length; c++) {
            for (var b = 1; b < e.rows[c].cells.length; b++) {
                Event.observe(e.rows[c].cells[b], "click", this.onClickCheckBox.bind(this, e.rows[c], e.rows[c].cells[b]))
            }
        }
    },
    onClickCheckBox: function (e, f) {
        var a = f.getElementsByTagName("input")[0];
        if (!a.checked) {
            a.checked = true;
            Event.fire(a, "change")
        }
        var c = this.colors[a.value].active;
        var d = false;
        for (var b = 1; b < e.cells.length; b++) {
            e.cells[b].style.backgroundColor = !d ? c : this.colors[b].inactive;
            if (e.cells[b] == f) {
                d = true
            }
        }
    }
});
View.Controls.GoogleMap.ReviewMap = Class.create({
    initialize: function (d, c) {
        this.div = document.getElementById(d);
        this.data = c;
        this.map = new GMap2(this.div);
        this.map.addControl(new GSmallZoomControl(), new GControlPosition(google.maps.ANCHOR_TOP_RIGHT, new GSize(10, 10)));
        var a = new GLatLng(this.data.latitude, this.data.longitude);
        this.map.setCenter(a, 12);
        this.map.setZoom(11);
        var b = new GIcon();
        b.iconSize = new GSize(18, 32);
        b.iconAnchor = new GPoint(9, 32);
        b.image = "/images/ico/maps/" + this.data.isp + ".gif";
        this.map.addOverlay(new GMarker(a, {
            icon: b
        }))
    }
});
View.Controls.GoogleMap.ReviewsMap = Class.create({
    initialize: function (f, e, d, c) {
        this.div = document.getElementById(f);
        this.zoom = c;
        var b = document.forms.delimit;
        this.isps = {};
        for (var a = 1; a < b.isp.options.length; a++) {
            this.isps[b.isp.options[a].value] = b.isp.options[a].text
        }
        this.technologies = {};
        for (var a = 1; a < b.technology.options.length; a++) {
            this.technologies[b.technology.options[a].value] = b.technology.options[a].text
        }
        this.speeds = {};
        for (var a = 1; a < b.speed.options.length; a++) {
            this.speeds[b.speed.options[a].value] = b.speed.options[a].text
        }
        this.regions = {};
        for (var a = 1; a < b.region.options.length; a++) {
            this.regions[b.region.options[a].value] = b.region.options[a].text
        }
        this.iconType = b.icons[0].checked && b.icons[0].value || b.icons[1].checked && b.icons[1].value || b.icons[2].checked && b.icons[2].value;
        this.map = new GMap2(this.div);
        this.map.addControl(new GLargeMapControl(), new GControlPosition(google.maps.ANCHOR_TOP_RIGHT, new GSize(10, 10)));
        this.map.setCenter(new GLatLng(d[0], d[1]), this.zoom);
        this.baseIcon = new GIcon();
        this.baseIcon.iconSize = new GSize(18, 32);
        this.baseIcon.iconAnchor = new GPoint(9, 32);
        this.baseIcon.infoWindowAnchor = new GPoint(9, 6);
        this.updateData(e)
    },
    updateData: function (c, b, a) {
        this.reviews = this.parseData(c);
        this.redrawMarkers();
        if (b) {
            this.map.setCenter(new GLatLng(b[0], b[1]), a || this.zoom)
        }
    },
    updateIconType: function (a) {
        this.iconType = a;
        this.redrawMarkers()
    },
    parseData: function (g) {
        var c = [];
        var f = ["id", "latitude", "longitude", "locality", "region", "updated", "author", "authorPermalink", "authorIcon", "isp", "technology", "speed", "title", "punctuation", "comments", "permalink", "ispIcon", "technologyIcon", "speedIcon"];
        for (var b = 0; b < g.length; b++) {
            var e = {};
            for (var a = 0; a < f.length; a++) {
                e[f[a]] = g[b][a]
            }
            e.latitude = e.latitude + ((20 - Math.round(Math.random() * 40)) / 1000);
            e.longitude = e.longitude + ((20 - Math.round(Math.random() * 40)) / 1000);
            var d = e.speedIcon;
            if (e.speedIcon < 1000) {
                d = String(Math.floor(d / 100) / 10);
                while (d.length < 5) {
                    d = "0" + d
                }
            } else {
                d = String(Math.floor(d / 1000));
                while (d.length < 3) {
                    d = "0" + d
                }
            }
            e.speedIcon = d;
            c.push(e)
        }
        return c
    },
    redrawMarkers: function () {
        this.map.clearOverlays();
        for (var b = 0, a = this.reviews.length; b < a; b++) {
            var e = this.reviews[b];
            var c = new GIcon(this.baseIcon, "/images/ico/maps/" + e[this.iconType + "Icon"] + ".gif");
            var d = new GMarker(new GLatLng(e.latitude, e.longitude), {
                icon: c
            });
            GEvent.addListener(d, "click", this.onClickMarker.bind(this, e));
            this.map.addOverlay(d)
        }
    },
    onClickMarker: function (d) {
        var c = "" + d.id;
        while (c.length < 8) {
            c = "0" + c
        }
        var b = new Date(d.updated * 1000);
        var a = '<div style="width:300px;height:186px" class=infoWindow><div class=balloon><h1><a href=/analisis/' + d.id + "/" + d.permalink + '><img alt="' + this.isps[d.isp] + '" src="/shadow/isp/' + d.isp.toString(36) + '/icon.gif"/> ' + this.isps[d.isp] + " " + this.technologies[d.technology] + " " + this.speeds[d.speed] + "<br><span>en " + d.locality + ", " + this.regions[d.region] + '</span></a></h1><img alt="' + d.punctuation + '" src="/shadow/isp/review/graph-' + c + '.png" class=graph></div><div class=arrow><div class=a><div class=userTx><img alt="' + d.author + '" src="' + d.authorIcon + '"/> <a class=u title=Autor href=/usuarios/' + d.authorPermalink + ">" + d.author + '</a><br><time title="Fecha/hora">' + b.getDate() + "/" + (b.getMonth() + 1) + "/" + b.getFullYear() + " " + b.getHours() + ":" + b.getMinutes() + "</time>";
        "</div></div></div></div>";
        this.map.openInfoWindowHtml(new GLatLng(d.latitude, d.longitude), a)
    }
});