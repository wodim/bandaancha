Object.extend(Controller.prototype, {
    adsl: function () {
        new View.Controls.PackagesTable(Element.select(document.body, "div.packages table")[0])
    },
    adslPhone: function () {
        new View.Controls.PackagesTable(Element.select(document.body, "div.packages table")[0])
    },
    adslTv: function () {
        new View.Controls.PackagesTable(Element.select(document.body, "div.packages table")[0])
    },
    adslBitstream: function () {
        new View.Controls.PackagesTable(Element.select(document.body, "div.packages table")[0])
    },
    mobile: function () {
        new View.Controls.PackagesTable(Element.select(document.body, "div.packages table")[0])
    },
    ftth: function () {
        new View.Controls.PackagesTable(Element.select(document.body, "div.packages table")[0])
    },
    isp: function () {
        var a = Element.select(document.body, "div.packages table");
        if (a[0]) {
            new View.Controls.PackagesTable(a[0]);
            if (a[1]) {
                new View.Controls.PackagesTable(a[1])
            }
        }
    },
    "package": function () {}
});
View.Controls.PackagesTable = Class.create({
    cols: ["isp", "transfer", "speed", "monthly", "year"],
    initialize: function (f) {
        if (!f.rows[1]) {
            return
        }
        this.table = f;
        var g = {};
        for (var d = 0, a = this.cols.length; d < a; d++) {
            var c = this.cols[d];
            var b = Element.select(this.table, "td." + c)[0];
            if (b) {
                b = b.cellIndex;
                var e = this.table.rows[0].cells[b];
                Event.observe(e, "click", this.onClickHeader.bind(this, c));
                g[c] = {
                    index: b,
                    th: e
                }
            }
        }
        this.cols = g;
        this.orderArrowImg = this.table.rows[0].getElementsByTagName("img")[0]
    },
    onClickHeader: function (c, e) {
        var g = [];
        for (var d = 1, a = this.table.rows.length; d < a; d++) {
            g.push(this.table.rows[d])
        }
        g.sort(this["sort_" + c].bind(this));
        var b = this.cols[c].th.getElementsByTagName("img")[0];
        if (b && b.src.indexOf("/orderasc.") > -1) {
            g.reverse()
        }
        var f = g[0].parentNode;
        for (var d = 0, a = g.length; d < a; d++) {
            var h = g[d];
            f.removeChild(h);
            f.appendChild(h)
        }
        this.showSortedHeader(c)
    },
    sort_isp: function (f, e) {
        var d = f.cells[this.cols.isp.index].getElementsByTagName("img")[0].alt;
        var c = e.cells[this.cols.isp.index].getElementsByTagName("img")[0].alt;
        if (d == c) {
            return this.sort_speed(f, e)
        }
        if (d < c) {
            return -1
        }
        if (d > c) {
            return 1
        }
        return 0
    },
    sort_transfer: function (f, e) {
        var d = this.getTransfer(f.cells[this.cols.transfer.index]);
        var c = this.getTransfer(e.cells[this.cols.transfer.index]);
        if (d < c) {
            return -1
        }
        if (d > c) {
            return 1
        }
        return 0
    },
    sort_speed: function (h, g) {
        var f = h.cells[this.cols.speed.index];
        var d = g.cells[this.cols.speed.index];
        var e = this.getSpeed(f);
        var c = this.getSpeed(d);
        if (e == c) {
            e = this.getSpeed(f, true);
            c = this.getSpeed(d, true)
        }
        if (e == c && this.cols.transfer) {
            return this.sort_transfer(h, g)
        }
        if (e < c) {
            return -1
        }
        if (e > c) {
            return 1
        }
        return 0
    },
    sort_monthly: function (h, g) {
        var f = h.cells[this.cols.monthly.index];
        var d = g.cells[this.cols.monthly.index];
        var e = this.getMonthly(f);
        var c = this.getMonthly(d);
        if (e == c) {
            e = this.getMonthly(f, true);
            c = this.getMonthly(d, true)
        }
        if (e < c) {
            return -1
        }
        if (e > c) {
            return 1
        }
        return 0
    },
    sort_year: function (f, e) {
        var d = this.getYear(f.cells[this.cols.year.index]);
        var c = this.getYear(e.cells[this.cols.year.index]);
        if (d < c) {
            return -1
        }
        if (d > c) {
            return 1
        }
        return 0
    },
    showSortedHeader: function (a) {
        if (this.orderArrowImg.parentNode == this.cols[a].th) {
            this.orderArrowImg.src = this.orderArrowImg.src.indexOf("/orderasc.") > -1 ? this.orderArrowImg.src.replace("/orderasc.", "/orderdesc.") : this.orderArrowImg.src.replace("/orderdesc.", "/orderasc.")
        } else {
            var b = this.orderArrowImg.parentNode;
            b.removeChild(this.orderArrowImg);
            this.cols[a].th.appendChild(this.orderArrowImg);
            this.orderArrowImg.previousSibling.nodeValue = this.orderArrowImg.previousSibling.nodeValue.replace(/([^ ])$/, "$1 ");
            this.orderArrowImg.src = this.orderArrowImg.src.replace("/orderdesc.", "/orderasc.")
        }
    },
    getTransfer: function (a) {
        var b = a.getElementsByTagName("strong")[0].innerHTML.match(/(\d+) (GB|MB)/);
        return parseInt(b[2] == "GB" ? b[1] * 1000 : b[1])
    },
    getSpeed: function (b, a) {
        return parseInt(b.getElementsByTagName(a ? "span" : "strong")[0].innerHTML.replace(/[^\d]/, ""))
    },
    getMonthly: function (a, b) {
        if (b) {
            var c = a.getElementsByTagName("span")[0];
            return c ? parseInt(c.innerHTML.replace(/[^\d,. ]/, "")) : 0
        } else {
            return parseInt(a.getElementsByTagName("strong")[0].innerHTML.replace(/[^\d,. ]/, ""))
        }
    },
    getYear: function (a) {
        return parseInt(a.innerHTML.replace(/[^\d,. ]/, ""))
    }
});