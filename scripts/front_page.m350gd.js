Object.extend(Controller.prototype, {
    index: function () {
        var c = $$("article.story, article.comment");
        for (var b = 0, a = c.length; b < a; b++) {
            if (c[b].className.indexOf("story") != -1) {
                new View.Controls.Post.Commentable.Story.Summary(c[b])
            } else {
                new View.Controls.Post.Comment.Summary(c[b])
            }
        }
    }
});
View.Controls.GoogleMap.LastReviewsMap = Class.create({
    initialize: function (f) {
        this.data = f;
        this.div = document.getElementById("reviewsMap");
        var c = this.div.getElementsByTagName("img")[0];
        c.onmouseover = function () {
            if (!this.apiLoading) {
                this.loadApi()
            }
        }.bind(this);
        var b = $("reviewsBox").getElementsByTagName("table")[0].getElementsByTagName("a");
        this.reviews = {};
        for (var e = 0, a = b.length; e < a; e++) {
            var d = b[e];
            var g = parseInt(d.href.match(/analisis\/(\d+)\//)[1]);
            d.onmouseover = this.onMouseOverAnchor.bind(this, g);
            d.onmouseout = this.onMouseOutAnchor.bind(this, g);
            this.reviews[g] = {};
            this.reviews[g].anchor = d
        }
        this.initMap = this.initMap.bind(this)
    },
    loadApi: function () {
        this.apiLoading = true;
        var a = document.createElement("script");
        a.setAttribute("src", "http://maps.google.com/maps?file=api&v=2.x&key=ABQIAAAAoXTaGyplNA2G8hiro3cX-RTE0v9_GLfZuwD5QrwDHZXWBzBmDxR4T_zK10oyAZUJ667Q3v360Hyr0A&c&async=2&callback=controller.lastReviewsMap.initMap");
        document.documentElement.firstChild.appendChild(a)
    },
    initMap: function () {
        this.map = new GMap2(this.div);
        this.map.setCenter(new GLatLng(View.Controls.GoogleMap.DEFAULT_LATITUDE, View.Controls.GoogleMap.DEFAULT_LONGITUDE), 5);
        this.baseIcon = new GIcon();
        this.baseIcon.iconSize = new GSize(18, 32);
        this.baseIcon.iconAnchor = new GPoint(9, 32);
        for (var c in this.data) {
            var b = this.data[c];
            var a = new GMarker(new GLatLng(b[1], b[2]), {
                icon: new GIcon(this.baseIcon, "/images/ico/maps/" + b[0] + ".gif")
            });
            GEvent.addListener(a, "click", this.onClickMarker.bind(this, c));
            this.map.addOverlay(a);
            this.reviews[c].marker = a
        }
        this.mapInitialized = true
    },
    onMouseOverAnchor: function (a) {
        if (!this.apiLoading) {
            this.loadApi();
            return
        }
        if (!this.mapInitialized) {
            return
        }
        clearTimeout(this.timer);
        for (var b in this.reviews) {
            this.reviews[b].marker[b == a ? "show" : "hide"]()
        }
    },
    onMouseOutAnchor: function (a) {
        clearTimeout(this.timer);
        this.timer = setTimeout(function () {
            for (var b in this.reviews) {
                this.reviews[b].marker.show()
            }
        }.bind(this), 1000)
    },
    onClickMarker: function (a) {
        view.highlighter.start(this.reviews[a].anchor.parentNode)
    }
});