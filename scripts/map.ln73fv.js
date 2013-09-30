Object.extend(Controller.prototype, {
    bts: function () {
        var a = this.btsMap.form.address;
        Field.focus(a);
        Field.select(a)
    }
});
View.Controls.GoogleMap.BtsMap = Class.create({
    btsMarkers: {},
    coverageCircles: {
        gsm_urban: [1, 5455],
        gsm_rural: [2, 5455],
        umts_urban: [0.5, 5455],
        umts_rural: [1.5, 5455]
    },
    initialize: function (center, zoom, isps) {
        this.center = center;
        this.zoom = zoom;
        this.isps = isps;
        this.form = document.forms.delimit;
        this.form.validator = new Validator(this.form, false);
        with(this.form) {
            validator.validates(address, "Dirección", {
                length: {
                    min: 3,
                    max: 72
                },
                format: "text"
            })
        }
        Event.observe(this.form, "submit", this.onSubmitForm.bind(this));
        var button = Element.select(this.form, "button[type=reset]")[0];
        Event.observe(button, "click", this.onClickResetButton.bind(this));
        button = Element.select(this.form, "button[type=button]")[0];
        Event.observe(button, "click", this.onClickGeolocatemeButton.bind(this));
        this.mapDiv = document.getElementById("map");
        this.btsTilesOverlay = new GTileLayerOverlay(new GTileLayer(null, null, null, {
            tileUrlTemplate: "/tms/bts/{Z}/{X}/{Y}.png",
            isPng: true
        }));
        var preset = this.readCookie();
        if (preset) {
            if (preset.charAt(0) == "-") {
                preset = preset.substr(1);
                this.start(true);
                this.setFromPreset(preset);
                Element.scrollTo(this.form)
            } else {
                Event.observe(this.mapDiv, "mouseover", function () {
                    if (this.started) {
                        return
                    }
                    this.start(true);
                    this.setFromPreset(preset)
                }.bind(this))
            }
        } else {
            Event.observe(this.mapDiv, "mouseover", function () {
                this.start()
            }.bind(this))
        }
    },
    start: function (a) {
        if (this.started) {
            return
        }
        var b = document.getElementById("mapBar");
        this.statusSpan = b.getElementsByTagName("span")[0];
        this.linkAnchor = b.getElementsByTagName("a")[0];
        this.mapDiv.style.backgroundImage = "none";
        this.map = new GMap2(this.mapDiv, {
            draggableCursor: "default"
        });
        this.map.addControl(new GLargeMapControl());
        GEvent.addListener(this.map, "zoomend", function (e, d) {
            if (e > 14 && d < 15) {
                this.map.removeOverlay(this.btsTilesOverlay);
                this.statusSpan.innerHTML = "<strong>Aumenta el zoom</strong> para ver los iconos de las estaciones base";
                this.highlight(this.statusSpan)
            } else {
                if (e < 15 && d > 14) {
                    this.map.addOverlay(this.btsTilesOverlay);
                    this.statusSpan.innerHTML = ""
                }
            }
        }.bind(this));
        GEvent.addListener(this.map, "click", function (d, e) {
            clearTimeout(this.onClickMapTimer);
            this.onClickMapTimer = setTimeout(this.onClickMap.bind(this, d, e), 400)
        }.bind(this).bind(this));
        GEvent.addListener(this.map, "dblclick", function () {
            clearTimeout(this.onClickMapTimer)
        }.bind(this));
        this.baseIcon = new GIcon();
        this.baseIcon.iconSize = new GSize(18, 32);
        this.baseIcon.iconAnchor = new GPoint(9, 32);
        this.baseIcon.infoWindowAnchor = new GPoint(9, 6);
        this.geocoder = new GClientGeocoder();
        this.geocoder.setBaseCountryCode("es");
        var c = document.getElementById("results");
        this.ueField = Element.select(c, ".ue span")[0];
        this.distanceField = Element.select(c, ".distance div")[0];
        this.bearingField = Element.select(c, ".distance span")[0];
        this.btsField = Element.select(c, "td.bts")[0];
        this.defaultFieldValues = {
            ue: this.ueField.innerHTML,
            distance: this.distanceField.innerHTML,
            bearing: this.bearingField.innerHTML,
            bts: this.btsField.innerHTML
        };
        if (!a) {
            this.map.setCenter(new GLatLng(this.center[0], this.center[1]), this.zoom);
            if (this.map.getZoom() > 14) {
                this.map.addOverlay(this.btsTilesOverlay)
            }
        }
        this.started = true
    },
    onSubmitForm: function (a) {
        this.start();
        if (this.form.validator.valid()) {
            Element.addClassName(this.ueField.parentNode, "loading");
            this.geocoder.getLocations(this.form.address.value, function (b) {
                Element.removeClassName(this.ueField.parentNode, "loading");
                if (!b || b.Status.code != 200) {
                    alert("Dirección no encontrada")
                } else {
                    this.setUeMarker(b.Placemark[0]);
                    this.map.setCenter(this.ueMarker.getLatLng(), 15);
                    this.setBtsMarker(null);
                    this.saveCookie()
                }
            }.bind(this))
        } else {
            alert(this.form.validator.getErrors().join("\n"));
            Field.activate(this.form.validator.firstWrongField())
        }
        Event.stop(a || window.event)
    },
    onClickResetButton: function (event) {
        this.start();
        this.btsMarkers = {};
        this.ueMarker = this.btsMarker = this.distancePolyline = undefined;
        with(this.form) {
            address.value = ""
        }
        this.map.clearOverlays();
        this.map.setCenter(new GLatLng(this.center[0], this.center[1]), this.zoom);
        if (this.map.getZoom() > 14) {
            this.map.addOverlay(this.btsTilesOverlay)
        }
        this.ueField.innerHTML = this.defaultFieldValues.ue;
        this.distanceField.innerHTML = this.defaultFieldValues.distance;
        this.bearingField.innerHTML = this.defaultFieldValues.bearing;
        this.btsField.innerHTML = this.defaultFieldValues.bts;
        this.saveCookie(true);
        Event.stop(event || window.event)
    },
    onClickGeolocatemeButton: function () {
        if (!navigator || !navigator.geolocation) {
            alert("Tu navegador no permite determinar tu ubicación actual")
        }
        navigator.geolocation.getCurrentPosition(function (a) {
            alert(a.coords.latitude + "," + a.coords.longitude)
        }.bind(this))
    },
    onClickMap: function (f, h) {
        if (f) {
            return
        }
        Element.addClassName(this.btsField, "loading");
        var b = this.map.getBounds();
        var d = b.getNorthEast();
        var c = b.getSouthWest();
        var e = this.map.getSize();
        var a = this.map.fromLatLngToContainerPixel(h);
        var g = {
            authenticity_token: controller.authenticity_token,
            left: c.lng(),
            top: d.lat(),
            right: d.lng(),
            bottom: c.lat(),
            width: e.width,
            height: e.height,
            x: a.x,
            y: a.y
        };
        new Ajax.Request("/", {
            parameters: g,
            onComplete: function (j, i) {
                Element.removeClassName(this.btsField, "loading");
                if (!i || !j.request.success()) {
                    alert("Se ha producido un error al cargar los datos remotos");
                    return
                }
                if (i.result) {
                    this.addBtsMarker(i.data);
                    this.saveCookie()
                }
            }.bind(this)
        })
    },
    setUeMarker: function (b) {
        var a = new GLatLng(b.Point.coordinates[1], b.Point.coordinates[0]);
        if (this.ueMarker) {
            this.ueMarker.setLatLng(a)
        } else {
            var c = new GIcon(this.baseIcon, "/images/map/ue.gif");
            this.ueMarker = new GMarker(a, {
                icon: c,
                draggable: true
            });
            GEvent.addListener(this.ueMarker, "click", function () {
                this.highlight(this.ueField)
            }.bind(this));
            GEvent.addListener(this.ueMarker, "dragend", function () {
                Element.addClassName(this.ueField.parentNode, "loading");
                this.geocoder.getLocations(this.ueMarker.getLatLng(), function (d) {
                    Element.removeClassName(this.ueField.parentNode, "loading");
                    if (!d || d.Status.code != 200) {
                        this.ueField.innerHTML = "Sin dirección"
                    } else {
                        this.ueField.innerHTML = this.form.address.value = d.Placemark[0].address
                    }
                    this.highlight(this.ueField);
                    this.drawDistance();
                    this.saveCookie()
                }.bind(this))
            }.bind(this));
            this.map.addOverlay(this.ueMarker)
        }
        this.ueField.innerHTML = this.form.address.value = b.address;
        this.highlight(this.ueField)
    },
    addBtsMarker: function (e) {
        var d = this.btsMarkers[e.id];
        if (!d) {
            var b;
            for (b in e.coverage) {
                break
            }
            var a = new GLatLng(e.latitude, e.longitude);
            var c = new GIcon(this.baseIcon, "/images/map/" + this.isps[b][0] + ".gif");
            d = new GMarker(a, {
                icon: c
            });
            d.data = e;
            GEvent.addListener(d, "click", function (f) {
                this.setBtsMarker(f);
                this.saveCookie()
            }.bind(this, d));
            this.map.addOverlay(d);
            this.btsMarkers[e.id] = d
        }
        this.setBtsMarker(d)
    },
    setBtsMarker: function (f) {
        this.btsMarker = f;
        if (f) {
            var e = this.btsField.getElementsByTagName("div");
            var c = 0;
            for (var b in f.data.coverage) {
                var d = [];
                var a = f.data.coverage[b];
                if (a.gsm) {
                    d.push("<strong>GSM</strong> " + a.gsm.join(", ") + " Mhz")
                } else {
                    d.push("")
                } if (a.umts) {
                    d.push("<strong>3G</strong> " + a.umts.join(", ") + " Mhz")
                }
                d = '<img src="/images/isp/' + this.isps[b][0] + '.gif" alt="' + this.isps[b][1] + '" title="' + this.isps[b][1] + '"/> ' + d.join("<br/>");
                if (e[c]) {
                    e[c].innerHTML = d
                } else {
                    var g = document.createElement("div");
                    g.innerHTML = d;
                    this.btsField.appendChild(g)
                }
                c++
            }
            while (e[c]) {
                this.btsField.removeChild(e[c])
            }
            this.highlight(e[0])
        } else {
            this.btsField.innerHTML = this.defaultFieldValues.bts
        }
        this.drawCoverage();
        this.drawDistance()
    },
    drawCoverage: function () {},
    drawDistance: function () {
        if (this.distancePolyline) {
            this.map.removeOverlay(this.distancePolyline)
        }
        if (!this.ueMarker || !this.btsMarker) {
            this.distanceField.innerHTML = this.bearingField.innerHTML = "";
            return
        }
        this.distancePolyline = new GPolyline([this.ueMarker.getLatLng(), this.btsMarker.getLatLng()], "#0055ff", 4);
        this.map.addOverlay(this.distancePolyline);
        var a = this.ueMarker.getLatLng().distanceFrom(this.btsMarker.getLatLng());
        this.distanceField.innerHTML = Math.round(a) + " metros";
        this.bearingField.innerHTML = this.bearing(this.ueMarker.getLatLng(), this.btsMarker.getLatLng()) + " grados";
        this.highlight(this.distanceField);
        this.highlight(this.bearingField)
    },
    generatePreset: function () {
        var c = "1";
        var b = 0;
        var a = this.map.getCenter();
        var d = a.lat();
        if (d < 0) {
            b = 128
        }
        c += this.compactCoord(d);
        d = a.lng();
        if (d < 0) {
            b |= 64
        }
        c += this.compactCoord(d);
        c += this.map.getZoom().toString(36);
        if (this.ueMarker) {
            a = this.ueMarker.getLatLng();
            d = a.lat();
            if (d < 0) {
                b |= 32
            }
            c += this.compactCoord(d);
            d = a.lng();
            if (d < 0) {
                b |= 16
            }
            c += this.compactCoord(d)
        } else {
            c += "000000000000"
        } if (this.btsMarker) {
            c += this.btsMarker.data.id.toString(36)
        }
        c += b.toString(36).rjust(2, "0");
        return c
    },
    setFromPreset: function (c) {
        var b = c.length;
        var a = parseInt(c.substr(c.length - 2), 36);
        GEvent.addListener(this.map, "load", function () {
            var e = this.uncompactCoord(c.substr(14, 6), a & 32),
                d = this.uncompactCoord(c.substr(20, 6), a & 16);
            if (e && d) {
                Element.addClassName(this.ueField.parentNode, "loading");
                this.geocoder.getLocations(new GLatLng(e, d), function (h) {
                    Element.removeClassName(this.ueField.parentNode, "loading");
                    if (!h || h.Status.code != 200) {
                        alert("Dirección no encontrada")
                    } else {
                        var g = h.Placemark[0];
                        g.Point.coordinates[1] = e;
                        g.Point.coordinates[0] = d;
                        this.setUeMarker(g);
                        this.drawDistance();
                        this.saveCookie()
                    }
                }.bind(this))
            }
            var f = c.substring(26, c.length - 2);
            if (f.length) {
                Element.addClassName(this.btsField, "loading");
                new Ajax.Request("/", {
                    parameters: {
                        id: parseInt(f, 36),
                        authenticity_token: controller.authenticity_token
                    },
                    onComplete: function (h, g) {
                        Element.removeClassName(this.btsField, "loading");
                        if (!g || !h.request.success()) {
                            alert("Se ha producido un error al cargar los datos remotos");
                            return
                        }
                        if (g.result) {
                            this.addBtsMarker(g.data)
                        }
                    }.bind(this)
                })
            }
        }.bind(this));
        this.map.setCenter(new GLatLng(this.uncompactCoord(c.substr(1, 6), a & 128), this.uncompactCoord(c.substr(7, 6), a & 64)), parseInt(c.substr(13, 1), 36));
        if (this.map.getZoom() > 14) {
            this.map.addOverlay(this.btsTilesOverlay)
        }
    },
    compactCoord: function (a) {
        var b = a.toString().split(".");
        return Math.abs(parseInt(b[0]), 10).toString(36).rjust(2, "0") + parseInt(b[1].ljust(6, "0").substr(0, 6), 10).toString(36).rjust(4, "0")
    },
    uncompactCoord: function (b, a) {
        var c = parseFloat(parseInt(b.substr(0, 2), 36) + "." + parseInt(b.substr(2, 4), 36).toString().rjust(6, "0"));
        if (a) {
            c = -c
        }
        return c
    },
    saveCookie: function (b) {
        var a, c = new Date(),
            d;
        if (b) {
            d = -1;
            a = "";
            this.linkAnchor.href = "/"
        } else {
            d = 15;
            a = this.generatePreset();
            this.linkAnchor.href = "/?s=" + a
        }
        c.setTime(c.getTime() + (d * 24 * 60 * 60 * 1000));
        document.cookie = "map_stage=" + a + "; expires=" + c.toGMTString() + "; path=/"
    },
    readCookie: function () {
        var a = document.cookie.match(/map_stage=([^;]+)/);
        if (a) {
            return a[1]
        }
    },
    bearing: function (g, f) {
        var e = g.latRadians(),
            c = g.lngRadians(),
            b = f.latRadians(),
            a = f.lngRadians();
        var d = -Math.atan2(Math.sin(c - a) * Math.cos(b), Math.cos(e) * Math.sin(b) - Math.sin(e) * Math.cos(b) * Math.cos(c - a));
        if (d < 0) {
            d += Math.PI * 2
        }
        d = Math.round(d * 180 / Math.PI);
        return d
    },
    highlight: function (a) {
        new Effect.Highlight(a, {
            endcolor: "#373845",
            restorecolor: "transparent"
        })
    }
});