RivalTracker
============

A JavaScript library to embed motorsport circuit maps (SVG format) onto websites and animate/simulate race sessions.

Possible use cases; 

1. Add vector circuit maps to websites from a growing library of prepared maps
2. A framework to draw cars/nodes on said map and animate their progress in near realtime fashion - allowing for at-a-glance race coverage and standings updates.
3. Provides 'crew-chief/race engineer' functions where engineers can make race decisions based on the current status of the race (e.g. when to pit).

The framework uses the 'requestAnimationFrame' request of browsers to provide higher fidelity (read:fluid) updates and supports 60fps updates where possible.

Implementation
==============

```javascript
var myTrackMap = new RivalTracker("divId", "trackId", driverData, [options]); 
```

Overview of the params:
```
divId - id of the containing div (with a width property set)
trackId - unique name of the track map that should be rendered (e.g. "daytona_oval") Check the RivalTrackerPaths js for an exhaustive list of tracks
driverData - object representing the positional data of the drivers on the track, e.g. :

var driverData = {
    "driver1" : 0,  // 0% through the track
    "driver2" : 0.15,  // 1.5% through the track
    "driver3" : 0.55  // 5.5% through the track
}
````

The driver names that are displayed on the map are taken from the key of the key/value pairs in the driverData object. 

options - set of (optional) configuration options that can alter the way the trackmap is rendered/behaves.  The full range of options is below:

```
var options = {
    scaling : 100,          (used to grow or shrink the generated circuit map asset)
    maxPrediction : 8000,   (number of ms of prediction movement to apply to the nodes in case of delayed data updates)
    pathColor : '#000000',  (colour of the main track path)
    pathStrokeWidth : 6,    (width of the main track path)
    nodeSize : 15,          (size of the node/markers representing drivers)
    nodeStrokeWidth : 2,    (node/marker stroke width)
    nodeStrokeColor : '#000000',    (colour of the node/marker stroke)
    labelFont : "Arial",    (font used to draw the node/marker text)
    labelFontSize : '11px', (size of text used to draw node/marker text)
    labelStrokeWidth : 2,   (node/marker text stroke width)
    labelStrokeColor : '#000000',   (colour of node/marker text stroke)
    labelColor : '#FFFFFF', (colour of the node/marker text)
    labelVertOffset : 0,    (number of pixels to offset the node/marker text. Can be used to have text floating above or below markers)
    reportBufferStatus : true   (provide buffer status updates directly on the map. Further information below)
}
```
######reportBufferStatus
The dot above the 'i' in the Rival Tracker logo (drawn near the circuit map) is an indicator of the movement data buffer status.  If there is data being processed from the movement buffer the dot is coloured green.  When the buffer empties (no data remaining) the dot will be coloured amber to indicate that current movement is predicted.  If the prediction duration (as configured by options.maxPrediction) expires then all track movement will cease and the status indicator is coloured red.

If options.reportBufferStatus is set to 'false' there will be no buffer status updates and the indicator will remain black (or the colour as set by options.pathColor).  Prediction will still occur where appropriate, but it will not be reported via the logo.

The option values above represent the default options and only the overriden options need be provided (the library falls back to the default value for any option not provided).

####How To Provide Positional Updates
Once a RivalTracker object has been created and bound to a driverData object, the instance is immediately waiting for updates.  Implementing code should update the data in the bound driverData object and then call .updatePositions() on the RivalTracker object.  The duration of time between the initial RivalTracker object creation and the first updatePositions() call will determine the amount of buffer present.

As an example, if you create a RivalTracker instance and perform the first .updatePositions() call after 10 seconds the markers will begin moving from their original location until they reach their new position after 10 seconds (animating smoothly).  During that initial 10 seconds of movement a further update should have been received (with another call to .updatePositions()) which is queued up and processed once the first 10 second movement period has completed.

If the markers are moving and no secondary/queued updates are provided then RivalTracker will enter predictive movement phase and continue moving the markers at a similar speed to their previous update.  Once the late update finally comes the markers are smoothly merged from their predicted positions to their actual positions.

If the buffer needs to be reset for any reason (e.g. in the example provided perhaps the initial 10 second period is deemed to long and needs to be shortened) then this can be achieved with a call to .resetBuffer().  This puts the RivalTracker instance into its original state where it is waiting for the initial .updatePositions() call which will determine the buffer duration.  In the example given, if a call to .resetBuffer() is made followed by .updatePositions() after two seconds, then the total lag/delay would be reduced to two seconds in total.

Finally, it is more important to provide consistent updates than it is to provide fast updates.  RivalTracker will perform better with regular 30 second updates than it will with updates ranging from 1-20 seconds with a wide variation between updates.


Example Implementations
=======================
### JavaScript
An example 100% JavaScript implementation is provided under /examples (RivalTrackerOfflineDemo.htm)
### C# iRacing
A C#/JavaScript implementation is also available for use with iRacing.  A C# WebSockets server communicates with iRacing and provides live positional data to a JavaScript WebSockets client for map animation.  The project is available at [RivalTracker-for-iRacing](https://github.com/SamHazim/RivalTracker-for-iRacing)

RivalTracker API
================
A number of public functions can be executed on a RivalTracker object.
```
updatePositions()
setNodeColor(driver, colour)
setNodeStrokeColor(driver, colour)
setNodeStrokeWidth(driver, width)
setNodeStrokeDash(driver)
setLabelColor(driver, colour)
resetBuffer()
```

Notes
=====
* It is important to use the same driverData object from the beginning of the RivalTracker lifecycle through to the end.  Once a RivalTracker instance is bound to a driverData object it cannot use any other driverData object.
* Firefox 20 has poor SVG animation performance and is not recommended for use.  The latest Firefox nightly has brought things up to comparable speed with Chrome, but Chrome still seems to be the fastest.
* Different browsers will handle animation priority in different ways.  If you switch a tab with embedded RivalTracker into a background tab then depending on the browser the results could range from movements continuing at a reduced framerate (good) to the movements completely stopping and being queued up for movement when the tab is made active (bad)
* Once a RivalTracker map has been added to a div you should not attempt to perform any 'innerHTML' modifications to the div as the browser may stop node animation entirely.
* HTML pages must have the correct meta content type, e.g.
```
<meta http-equiv="content-type" content="application/xhtml+xml; charset=utf-8" />
```
* Careful consideration must be given to the settings for maxPrediction and also the update interval.  As a guideline, set options.maxPrediction to at least 3x the duration of the **maximum** update gap you expect (e.g. if you have updates every 3 seconds with occasional lags of 10 seconds, set maxPrediction to 20000ms)

Credits
=======
Copyright Sam Hazim 2013

Released under GPLv3
