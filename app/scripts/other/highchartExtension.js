$(function () {
    (function (H) {
        H.wrap(H.RangeSelector.prototype, 'setInputValue', function (boh, name, value) {
            //console.log(this);
            //console.log(boh);
            //console.log(name);
            //console.log(value);
            

            this[name + 'Input'].value = value;
            this[name + 'DateBox'].attr({ text:value});

        });
    }(Highcharts));
});