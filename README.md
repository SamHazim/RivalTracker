RivalTracker
============

A JavaScript library to embed (and animate/live update) motorsport circuit maps in Scalable Vector Graphic format onto websites.

At least two main use cases; 

1. An easy way to provide vector graphics of circuit maps (or indeed, any SVG path graphic of any type) onto websites.
2. (more interesting) A framework to render cars/nodes on said map and animate their progress in near realtime fashion - allowing for a rich race reporting experience.

The framework uses the 'requestAnimationFrame' request of browsers to provide higher fidelity (read:fluid) updates and supports 60fps updates where possible.

Examples
========
A quick and simple demonstration page is available at http://www.samiad.co.uk/RivalTracker/ featuring a small number of RivalTracker maps.

Implementation
==============

var myMap = new RivalTracker("divId", "trackId", driverData, [options]); 

Overview of the params:
divId = id of the containing div (with a width property set)
trackId = unique name of the track map that should be rendered (e.g. "daytona_oval")
driverData = object representing the positional data of the drivers on the track, e.g. :

var driverData = {
    "driver1" : 0,  // 0% through the track
    "driver2" : 1.5,  // 1.5% through the track
    "driver3" : 5.5  // 5.5% through the track
}

options = set of (optional) configuration options that can alter the way the trackmap is rendered/behaves.

Example iRacing Implementation
==============================

Known Issues
============

Credits
=======
