'use strict';

Colors = {};
Colors.names = {
    darkblue: "#00008b",
    
    black: "#000000",
    lightgreen: "#90ee90",
    


    blue: "#0000ff",
    lightblue: "#add8e6",
    green: "#008000",

    beige: "#f5f5dc",

    
    brown: "#a52a2a",
    darkcyan: "#008b8b",
    darkred: "#8b0000",
    
    
    
    darkgrey: "#a9a9a9",
    darkgreen: "#006400",
    darkkhaki: "#bdb76b",

    darkolivegreen: "#556b2f",
    darkorange: "#ff8c00",
    darkorchid: "#9932cc",
        red: "#ff0000",
    darkmagenta: "#8b008b",
    darksalmon: "#e9967a",
    darkviolet: "#9400d3",
    fuchsia: "#ff00ff",
    gold: "#ffd700",
    
    indigo: "#4b0082",
    khaki: "#f0e68c",
    
    lightcyan: "#e0ffff",
    
    lightgrey: "#d3d3d3",
    lightpink: "#ffb6c1",
    lightyellow: "#ffffe0",
    lime: "#00ff00",
    magenta: "#ff00ff",
    maroon: "#800000",
    navy: "#000080",
    olive: "#808000",
    orange: "#ffa500",
    pink: "#ffc0cb",
    purple: "#800080",
    violet: "#800080",

    silver: "#c0c0c0",
    aqua: "#00ffff",
    azure: "#f0ffff",
    white: "#ffffff",
    cyan: "#00ffff",
    yellow: "#ffff00"
};
Colors.random = function() {
    var result;
    var count = 0;
    for (var prop in this.names)
        if (Math.random() < 1/++count)
           result = prop;
    return { name: result, rgb: this.names[result]};
};

Colors.colorList = function(){
    var colors = [];
    for (var color in this.names){
        color = chroma(color).darken(10).hex();
        colors.push(color)
    }
    return colors;
}

