function setHeight($) {
    return;
    //return;
    var h = $(window).height();
    if (h<700){h=700}
    var w = h*4/3;
    var container = $("#jmpress .step");
    container.css("height", h+"px");
    container.css("width", w+"px");
    console.log(h,w);
}

function resizeSlides() {
    $(window).resize(function() {
        setHeight($);
    });
}

function fixStyles() {

    
    resizeSlides();
}


//jQuery(document).ready(function($) {
//    setRowWidth($); //if javascript is enabled, we need to do this at least once so that jmpress will initialize correctly
//    $('article#content').jmpress({
//        stepSelector: 'section.step'
//    }, fixStyles());
//});