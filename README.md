RivalTracker
============
Written and maintained by [Sam Hazim](https://twitter.com/SamHazim)

A JavaScript library to embed motorsport circuit maps (SVG format) onto websites and animate/simulate race sessions.

![RivalTrackerImage](http://i.imgur.com/kQAOdM7.png)

Possible use cases; 

1. Add vector circuit maps to websites from a growing library of prepared circuit maps
2. A framework to draw cars/nodes on said map and animate their progress in near realtime fashion - allowing for at-a-glance race coverage and standings updates.
3. Provides 'crew-chief/race engineer' functions where engineers can make race decisions based on the current status of the race (e.g. when to pit).

The framework uses the 'requestAnimationFrame' request of browsers to provide higher fidelity (read:fluid) updates and supports 60fps updates where possible.

How to implement
================
1/ Include the two Rival Tracker scripts

```javascript
<script src='js/RivalTracker.min.[version].js'></script>
<script src='js/RivalTrackerPaths.min.[version].js'></script>
```

2/ Create a driverData object to hold the driver position details.

```javascript
var driverData = {
    "driver1" : 0,  // 0% through the track
    "driver2" : 0.15,  // 1.5% through the track
    "driver3" : 0.55  // 5.5% through the track
}
```

3/ Create a new RivalTracker instance, binding the driverData object at creation time.

```javascript
var myTrackMap = new RivalTracker("divId", "trackId", driverData, [options]); 
```

Overview of the params:
```
divId - id of the containing div (with a width property set)
trackId - unique name of the track map that should be rendered (e.g. "daytona_oval") Check the RivalTrackerPaths js for a full list of tracks
driverData - the object containing the driver data to be used for this instance. The driver positions provided at creation will be the initial driver positions (e.g. the drivers could be all at 0% or they could be at varying positions along the track - it doesn't matter)
````

The driver names that are displayed on the map are taken from the key of the key/value pairs in the driverData object. 

options - set of (optional) configuration options that can alter the way the trackmap is rendered/behaves.  The full range of options are described below:

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
    callback : function(event){} (if you want to wire in behaviour when a driver marker is clicked, provide a callback function)
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

####Adding / Removing Drivers
Adding and removing drivers is simple.  Just add (or delete) properties to the bound driverData object.  The update will be applied at the next update cycle
To add a new driver (at 0% position):
```javascript
var driverData = {};
driverData["newDriver"] = 0;
```
To delete a driver:
```javascript
delete driverData["newDriver"]
```


Example Implementations
=======================
### JavaScript
An example 100% JavaScript implementation is provided (RivalTrackerJavascriptExample.htm)
### C# iRacing
A C#/JavaScript implementation is also available for use with iRacing.  A C# WebSockets server communicates with iRacing and provides live positional data to a JavaScript WebSockets client for map animation.  The project is available at [RivalTracker-for-iRacing](https://github.com/SamHazim/RivalTracker-for-iRacing)

RivalTracker API
================
A number of public functions can be executed on a RivalTracker object.
```
updatePositions()                   Clones the current state of driverData and applies (or queues) the update
setNodeColor(driver, colour)        Changes the colour of the provided marker
setNodeStrokeColor(driver, colour)  Changes the colour of the stroke around the marker
setNodeStrokeWidth(driver, width)   Changes the width of the stroke around the marker
setNodeStrokeDash(driver)           Draws the marker stroke in a fixed dash pattern
setLabelColor(driver, colour)       Changes the label colour of the provided marker
resetBuffer()                       Resets the RivalTracker instance to its initial state (waiting for its first update)
```

Notes
=====
* It is important to use the same driverData object from the beginning of the RivalTracker lifecycle through to the end.  Once a RivalTracker instance is bound to a driverData object it cannot use any other driverData object.
* IE has poor SVG support - IE8 has no native SVG support (but allows use of a plugin).  IE9 has native SVG support.
* Firefox 20 has poor SVG animation performance and is not recommended for use.  The latest Firefox nightly has brought things up to comparable speed with Chrome, but Chrome still seems to be the fastest.
* Different browsers will handle animation priority in different ways.  If you switch a tab with embedded RivalTracker into a background tab then depending on the browser the results could range from movements continuing at a reduced framerate (good) to the movements completely stopping and being queued up for movement when the tab is made active (bad)
* Once a RivalTracker map has been added to a div you should not attempt to perform any 'innerHTML' modifications to the div as the browser may stop node animation entirely.
* HTML pages must have the correct DOCTYPE:
```
<!DOCTYPE html>
```
and also the correct content-type:
```
<meta http-equiv="content-type" content="application/xhtml+xml; charset=utf-8" />
```
otherwise the maps won't display in IE9.
* Careful consideration must be given to the settings for maxPrediction and also the update interval.  As a guideline, set options.maxPrediction to at least 2x the duration of the **maximum** update gap you expect (e.g. if you have updates every 3 seconds with occasional lags of 10 seconds, set maxPrediction to 20000ms)

Credits
=======
Copyright Sam Hazim 2013

Released under GPLv3
