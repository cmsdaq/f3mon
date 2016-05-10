'use strict';

    //var $demo, duration, remaining, tour;
    //$demo = $("#demo");
    //duration = 5000;
    //remaining = duration;
    //
    
    
    

    var tourConfig = {
      getTourElement: function(tour){
        console.log('get element, ',tour)
        console.log(tour._options.steps[tour._current].element)
          return tour._options.steps[tour._current].element

      },  
      tour :     new Tour({
      onStart: function (tour) {
        $("#f3monButton").click();
      },
      onEnd: function(tour) {
        tour._options.backdrop = true;
        tour.hideStep(tour._current);
      },
      onShown: function(tour) {
        console.log(tour);
        var stepElement = tourConfig.getTourElement(tour);
        console.log(stepElement)
        $(stepElement).after($('.tour-step-background'));
        $(stepElement).after($('.tour-backdrop'));
      },
//      onStart: function() {
//        return $demo.addClass("disabled", true);
//      },
//      onEnd: function() {
//        return $demo.removeClass("disabled", true);
//      },
//      debug: true,
      basePath: "",
      orphan: true,
      backdrop: true,
      backdropPadding: 5,
      reflex: false,
      container: "body",
      storage: false,
      steps: [
        {
          title: "Welcome to F3 Monitoring page Tour!",
          content: "This guide will introduce the <strong>F3 monitoring page</strong>."
        },
         {
          title: "Welcome to F3 Monitoring page Tour!",
          content: "Let us examine all its components, one by one."
        }, 
        {
          element: "#header",
          placement: "bottom",
          title: "Navigation Bar",
          content: "The <strong>Navigation Bar</strong> allows you to switch between different panel layouts and options."
        }, 
        {
          element: "#f3monButton",
          placement: "bottom",
          title: "F3Mon Button",
          content: "If you click here, the page will show the main view."
        }, 
        {
          element: "#logButton",
          placement: "bottom",
          title: "Alerts",
          content: "The number of error messages sent by the HLTD daemon between the start and the end of the current run is shown here.",
          toggleBackDrop: true,
          onShown: function(tour){tour._options.onShown(tour); tour._options.backdrop = false;},
          onPrev: function(tour){tour._options.backdrop = true; tour.hideStep(tour._current);},
        }, 
        {
          element: "#logButton",
          placement: "bottom",
          title: "Alerts",
          content: "The number of error and fatal messages sent by the CMSSW processes in HLT between the start and the end of the current run is shown here.",
          toggleBackDrop: true,
          onShown: function(tour){tour._options.onShown(tour); tour._options.backdrop = false;},
          onPrev: function(tour){tour._options.backdrop = true; tour.hideStep(tour._current);},
        }, 
        {
          element: "#logButton",
          placement: "bottom",
          title: "Alerts",
          content: "Clicking on it will open the alert panel, through which you can examine the errors in detail.",
          onShown: function(tour){tour._options.backdrop = true;},
        }, 
        {
          element: "#indexButton",
          placement: "bottom",
          title: "Subsystem selector",
          content: "Here you can select which subsytem to display. ",
        }, 
        {
          element: "#riverStatusButton",
          placement: "bottom",
          title: "RunRiver Plugin Status",
          content: "This button shows the status of the <strong>RunRiver Plugin</strong>.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
          onPrev: function(tour){tour._options.backdrop = true; tour.hideStep(tour._current);},
        }, 
        {
          element: "#riverStatusButton",
          placement: "bottom",
          title: "River Service Status",
          content: "During normal operation it should be green, except when DAQ is not running. It may blink with different colors during the script start-stop procedures.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
        }, 
        {
          element: "#riverStatusButton",
          placement: "bottom",
          title: "RunRiver Plugin Status",
          content: "Clicking on it will spawn information about the servers that are currently hosting RunRiver instances.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = true;},
        }, 
        {
          element: "#runRangerButton",
          placement: "bottom",
          title: "Run Ranger",
          content: "If this button is active (green), the page will automatically show the most recent ongoin run.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
        }, 
        {
          element: "#runRangerButton",
          placement: "bottom",
          title: "Run Ranger",
          content: "If you want to stay on the current run, just click on it to disable the automatic switch.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = true;},
        }, 
        {
          element: "#siderbar",
          placement: "right",
          title: "Left side panels",
          content: "This is the information side of the page, 4 panels are shown.",
        }, 
        {
          element: "#runInfoPanel",
          placement: "right",
          title: "RunInfo Panel",
          content: "This panel shows general information about the current run.",
        }, 
        {
          element: "#disksInfoPanel",
          placement: "right",
          title: "Disk Usage Information Panel",
          content: "Here you can see the percentage of usage of the total disk space on the Bu-Fu appliances.",
        }, 
        {
          element: "#runListPanel",
          placement: "right",
          title: "Run list panel",
          content: "Through this panel you can browse different runs that are available in the F3 monitoring system.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
          onPrev: function(tour){tour._options.backdrop = true; tour.hideStep(tour._current);},
        }, 
        {
          element: "#runListPanel",
          placement: "right",
          title: "Run list panel",
          content: "If you click on the <span class='fa fa-play-circle'></span> button, the page will display information about the selected run.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = true;},
        }, 
        {
          element: "#riverListPanel",
          placement: "right",
          title: "River list panel",
          content: "This panel lists all the running instances of the RunRiver plugin.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
          onPrev: function(tour){tour._options.backdrop = true; tour.hideStep(tour._current);},
        }, 
        {
          element: "#riverListPanel",
          placement: "right",
          title: "River list panel",
          content: "The <span class='fa fa-power-off'></span> button allows to terminate the selected istance of the plugin ( MAKE SURE YOU KNOW WHAT YOU ARE DOING ).",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = true;},
        }, 
        {
          element: "#central",
          container: "#central",
          placement: "left",
          title: "Plot panels",
          content: "This is the main part of the monitoring page. Two panels are shown.",
          onNext: function(tour){$("#f3monButton").click();},
        }, 
        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "The first panel shows the amount of the events that pass the filter process for each stream and each lumisection. ",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
          onPrev: function(tour){tour._options.backdrop = true; tour.hideStep(tour._current);},
        }, 
        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "The plot is empty when there are no data. During normal operation, instead, it is divided in two parts. <br> <br> <img style='width:500px' src='images/f3mon-tour-sr.png'> ",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
        }, 
        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "The streams output are shown on the top side of the plot. <br> <br> <img style='width:500px' src='images/f3mon-tour-sr-top.png'>",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
        }, 
        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "On the bottom, the completion percentages of the miniMerging and macroMerging procedures are shown. <br> <br> <img style='width:500px' src='images/f3mon-tour-sr-bottom.png'> <br> <br> ",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
        }, 
        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "The color changes according to the percentage of completion of the merging. When a merging process completes successfully, the corresponding box becomes <font color='green'>green</font>.<br> <br> <img style='width:500px' src='images/f3mon-tour-sr-bottom.png'> <br> <br> ",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
        }, 

        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "If you need further details about the merging (e.g. if the bar stays <font color='red'>red</font>/<font color='orange'>orange</font> too long), clicking on the column box shows the merging status by stream or by single BU (2-level Drill-Down). ",
          onShown: function(tour){tour._options.onShown(tour); tour._options.backdrop = false;},
        }, 
        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "It Is possible to click on the legend to add/remove a stream from the view.<br> <br> <img style='width:500px' src='images/f3mon-tour-sr-legend.png'> ",
          onShown: function(tour){tour._options.onShown(tour); tour._options.backdrop = false;},
        }, 
        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "By default the plot will show the last 20 LS, you can use this control to change the LS range. <br> <br> <img style='width:500px' src='images/f3mon-tour-sr-selector.png'> ",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
        }, 
        {
          element: "#srPanel",
          placement: "bottom",
          title: "Stream Rates Plot",
          content: "To be as clear as possible the plot will show always about 20 point on the X-Axis, if you select a wider LS range they will be grouped showing the average. <br> <br> <img style='width:500px' src='images/f3mon-tour-sr-selector.png'> ",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = true;},
        }, 

        {
          element: "#sr-ddswitch",
          placement: "left",
          title: "DrillDown Selector",
          content: "This arrow allows you to switch between the main plot and the drill-down plot (when it is available).",
        }, 
        {
          element: "#sr-unitswitch",
          placement: "bottom",
          title: "Unit Selector",
          content: "It is possible to switch the unit of the y-axis from number of events to bytes. ",
        }, 
        {
          element: "#sr-divisor",
          placement: "bottom",
          title: "Stream Ouput Divisor",
          content: "It is possible to divide the stream output by a number. This can be useful to compute the streams rates.",
        },
        {
          element: "#sr-rangeselectswitch",
          placement: "bottom",
          title: "Range Selector Modifier",
          content: "It is possible to change the mode of in-plot range selection (mouse drag) to displaying selected range in micromerge or macromerge drilldown mode.",
        }, 
        {
          element: "#sr-qtdisplay",
          placement: "bottom",
          title: "Query Time",
          content: "This number shows the time it takes for the ES query to display data.",
        }, 
        {
          element: "#msPanel",
          placement: "top",
          title: "Microstate Plot Panel",
          content: "The Microstate chart shows an overview of the processors usage of the filter farm.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = false;},
          onPrev: function(tour){tour._options.backdrop = true; tour.hideStep(tour._current);},
        }, 
        {
          element: "#msPanel",
          placement: "top",
          title: "Microstate Plot Panel",
          content: "The plot shows the amount of CPUs devoted to certain processes, in percentage, during the last 60 seconds.",
          onShown: function(tour){tour._options.onShown(tour);tour._options.backdrop = true;},
        }, 
        {
          title: "That's all.",
          content: "This page is in constant development. There might be recently added features that are not included in this guide yet.",
         },
        {
          title: "That's all.",
          content: "Please be patient, and have fun!",
         }
      ]
    })
    }


    
//    $(".help").on("click", function(e) {
//      console.log('help click')
//      e.preventDefault();
//      
//      id = "#"+$(this).closest(".panel-primary").attr('id');
//      steps = tour._options.steps;
//      i = steps.map(function(e) { return e.element; }).indexOf(id);
//      tour.restart();
//      tour.goTo(i);
//
//    });
//
//    console.log('SETTING BUTTON')
//    //console.log($("#tourButton").text());
//    $("#tourButton").on("click", function(e) {
//      console.log("Start Tour");
//      //e.preventDefault();      
//
//      tour.restart();
//      //tour.goTo(10);
//      //return $(".alert").alert("close");
//    });

