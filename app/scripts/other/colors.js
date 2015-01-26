var colors =  {
        list : Highcharts.getOptions('colors').colors,
        index : 0,

        get : function() {
            var i = this.index;
            if (this.index == (this.list.length - 1)) {
                this.index = 0
            } else {
                this.index += 1
            }
            return this.list[i];
        },

        myReset : function(){
            return;
            console.log(this.index)
            this.index = 0;
            console.log('boh')
            
        }
    }
    