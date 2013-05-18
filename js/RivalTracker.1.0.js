/**
 * requestAnimationFrame shim
 */
(function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame =
          window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

var RivalTracker = (function () {
    
    RivalTracker = function(trackerDiv, trackId, rawTelemData, options) {
        // clone the passed in rawTelemData so we are protected from external changes
        var telemData = cloneTelemData();
        var lastTelemData = cloneTelemData();
        var percentChangePerMs = {};
        var predictionCatchupRate = 0.8;
	var predictionCatchupRateFast = 0.8;
	var predictionCatchupRateSlow = 0.4;
        var lastPredictionDuration = 0;
        var lastProcessedEpoc;
        var redFlag = 0;
        var nodes = {};
        var labels = {};
        var path;
        var trackLength;        
        var updateQueue = new Array();
        var awaitingFirstUpdate = true;
	var fastestUpdateRateSupported = 100; // drop fast incoming updates
        var lastUpdateTime = Date.now();
        var parentDiv = document.getElementById(trackerDiv);
        var bufferStatusColor = "#000000";
        var resetData = false;
        var buffer = 0;
        
        var colors = ["#000066","#00FFFF","#0000FF","#80FF00","#808080","#00FF00","#A02820","#FF00FF","#008000","#800000","#000080","#808000","#FFA000","#800080","#FF0000","#C0C0C0","#008080","#F080F0","#FF0066","#CC3366","#996666","#669966","#33CC66","#00FF66","#FFCCCC","#CCCCCC","#99CCCC","#66CCCC","#33CCCC","#00FFCC","#330066","#9900FF","#6699FF","#6666CC","#996633","#330000","#330033","#990066"]
        if(RivalTracker.paths[trackId] == undefined) trackId = "defaultMap";

        // set default options if not specified
        if(typeof options === "undefined") {
            // no options provided, set all options to default
            var options = {
		scaling : 100,
                maxPrediction : 8000,
                initialBuffer : 500,
                pathColor : '#000000',
                pathStrokeWidth : 6,
                nodeSize : 15,
                nodeStrokeWidth : 2,
                nodeStrokeColor : '#000000',
                labelFont : "Arial",
                labelFontSize : '11px',
                labelStrokeWidth : 2,
                labelStrokeColor : '#000000',
                labelColor : '#FFFFFF',
                labelVertOffset : 0,
                reportBufferStatus : true
            };
        } else {
            // some options provided, override any missing
            options.scaling = (typeof options.scaling === "undefined") ? "100" : options.scaling;
            options.maxPrediction = (typeof options.maxPrediction === "undefined") ? 8000 : options.maxPrediction;
            options.initialBuffer = (typeof options.initialBuffer === "undefined") ? 500 : options.initialBuffer;
            options.pathColor = (typeof options.pathColor === "undefined") ? "#000000" : options.pathColor;
            options.pathStrokeWidth = (typeof options.pathStrokeWidth === "undefined") ? 6 : options.pathStrokeWidth;
            options.nodeSize = (typeof options.nodeSize === "undefined") ? 15 : options.nodeSize;
            options.nodeStrokeWidth = (typeof options.nodeStrokeWidth === "undefined") ? 2 : options.nodeStrokeWidth;
            options.nodeStrokeColor = (typeof options.nodeStrokeColor === "undefined") ? '#000000' : options.nodeStrokeColor;
            options.labelFont = (typeof options.labelFont === "undefined") ? "Arial" : options.labelFont;
            options.labelFontSize = (typeof options.labelFontSize === "undefined") ? '11px' : options.labelFontSize;
            options.labelStrokeWidth = (typeof options.labelStrokeWidth === "undefined") ? 0 : options.labelStrokeWidth;
            options.labelStrokeColor = (typeof options.labelStrokeColor === "undefined") ? "#ffffff" : options.labelStrokeColor;
            options.labelColor = (typeof options.labelColor === "undefined") ? "#ffffff" : options.labelColor;
            options.labelVertOffset = (typeof options.labelVertOffset === "undefined") ? 0 : options.labelVertOffset;
            options.reportBufferStatus = (typeof options.reportBufferStatus === "undefined") ? true : options.reportBufferStatus;
        }

        var that = this;
        // create SVG instance
        this.svg = (function() {
            var NS="http://www.w3.org/2000/svg";
            var svg=document.createElementNS(NS,"svg");
            svg.setAttribute('width', '100%'); 
            // determine width from parent div, otherwise use document width             
            var width = parentDiv.clientWidth === 0 ? document.documentElement.clientWidth : parentDiv.clientWidth;
            svg.setAttribute('width', (width * options.scaling) / 100);            
            //a few calcs needed here, first take the actual parent div width, calculate the track specific height ratio, 
            //and then add any client requested scaling on top
            var height = width * (RivalTracker.paths[trackId].height/100);
            height = height * options.scaling / 100;
            svg.setAttribute('height', height);
            svg.setAttribute('preserveAspectRatio','xMinYMin slice');
            svg.setAttribute('viewBox', RivalTracker.paths[trackId].viewBox);
            svg.setAttribute('wmode','transparent');
            return svg;
        })();

        // lookup path from trackId
        (function constructSVG() {  
            var newPath
            for(var index in RivalTracker.paths[trackId].paths) {
                newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');    
                newPath.setAttribute('d', RivalTracker.paths[trackId].paths[index]);
		newPath.setAttribute('stroke-miterlimit', '4');
		newPath.setAttribute('stroke-width', options.pathStrokeWidth);
                newPath.setAttribute('stroke-dasharray', 'none');
                newPath.setAttribute('stroke', options.pathColor);
                newPath.setAttribute('fill', 'none');
                if(index == 0) {
                    // this is the first path, i.e. the main track path
                    newPath.setAttribute('id', 'trackPath'); 
                    newPath.setAttribute('stroke-opacity', '1');
                    path = newPath;
                } else {
                    newPath.setAttribute('stroke-opacity', '0.2');
                }
                that.svg.appendChild(newPath);
                trackLength = path.getTotalLength();
            }        

            // start/finish line drawing code, plus angle adjustment
            var startCoords = getPointAt(0);
            var pathAngle = getPointAt(0.1);
            var startFinishLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');            
            startFinishLine.setAttribute('x1', startCoords.x);
            startFinishLine.setAttribute('y1', startCoords.y - 15);
            startFinishLine.setAttribute('x2', startCoords.x);
            startFinishLine.setAttribute('y2', startCoords.y + 15);
            var dx =  startCoords.x - pathAngle.x;
            var dy =  startCoords.y - pathAngle.y;
            var rotateAngle = Math.atan(dy/dx) * (180 / Math.PI);
            var rotate = 'rotate(' + rotateAngle + ' ' + startCoords.x + ' ' + startCoords.y + ')';
            startFinishLine.setAttribute('transform', rotate);
            startFinishLine.setAttribute('stroke-width', options.pathStrokeWidth);
            startFinishLine.setAttribute('stroke', options.pathColor);
            that.svg.appendChild(startFinishLine);            
            // add logo
            drawLogo();            
        })();
        
        function drawLogo() {
            var logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g'); 
            logoGroup.setAttribute("id", "RivalTrackerLogo");
            logoGroup.setAttribute("transform", RivalTracker.paths[trackId].transform);
            logoGroup.addEventListener("mousedown", function() {            
                window.open("http://racingrivals.samiad.co.uk/",'_blank');
            }, false);
            var path;
            for(var index in RivalTracker.paths["logo"].rival) {
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	            if(index == 0) {
	                // identify and cache this element as we will change the colour at a later time.
	                path.setAttribute('id', 'dot');
	                nodes["dot"] = path;
	            }
                path.setAttribute('d', RivalTracker.paths["logo"].rival[index]);
                path.setAttribute('fill', options.pathColor);
                logoGroup.appendChild(path);
            }            
            for(var index in RivalTracker.paths["logo"].tracker) {
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	            path.setAttribute('d', RivalTracker.paths["logo"].tracker[index]);
	            path.setAttribute('fill', options.pathColor);
                logoGroup.appendChild(path);
            }            
            var trackName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            trackName.setAttribute("x",322);
            trackName.setAttribute("y",230);
            trackName.setAttribute("text-anchor","middle");
            trackName.setAttribute("font-family", "Calibri, Candara, Segoe, \"Segoe UI\", Optima, Arial, sans-serif");
            trackName.setAttribute("fill",options.pathColor);
            trackName.setAttribute("font-weight","normal");
            trackName.setAttribute("font-size","18");
            trackName.textContent = RivalTracker.paths[trackId].name;
            logoGroup.appendChild(trackName);
            that.svg.appendChild(logoGroup);
        }

        (function addSvgToDOM() {
            document.getElementById(trackerDiv).appendChild(that.svg);
        })();

        (function addDriversToTracker(){
            for(var driver in telemData){
                if(telemData.hasOwnProperty(driver)) { 
                    addDriverToTracker(driver);                    
                }
            }
        })();
        
        function addDriverToTracker(driver) {
            lastTelemData[driver] = telemData[driver];
            var pointOfDriver = getPointAt(lastTelemData[driver]);
            circle = nodes[driver];
            // check in case we are adding a hidden driver            
            if(circle === undefined) {
                // first time we have seen this driver, create node            
                var node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                node.setAttribute("id", driver + 'Node');
                node.setAttribute("cx", pointOfDriver.x);
                node.setAttribute("cy", pointOfDriver.y);
                node.setAttribute("r",  options.nodeSize);
                node.setAttribute("fill", getColor());
                node.setAttribute("stroke", options.nodeStrokeColor);
                node.setAttribute("stroke-width", options.nodeStrokeWidth);
                if(typeof options.callback === "function") {
                    node.addEventListener("mousedown", options.callback, false);
                }
                that.svg.appendChild(node);
                nodes[driver] = node; // store for quicker lookup
                var driverLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                if(typeof options.callback === "function") {
                    driverLabel.addEventListener("mousedown", options.callback, false);
                }
                driverLabel.setAttribute("id", driver + 'Label');
                driverLabel.setAttribute("x", pointOfDriver.x);
                driverLabel.setAttribute("y", pointOfDriver.y + (options.nodeSize/4) - options.labelVertOffset);
                driverLabel.setAttribute("fill",  options.labelColor);
                driverLabel.setAttribute("font-family", options.labelFont);
                driverLabel.setAttribute("font-size", options.labelFontSize);
                driverLabel.setAttribute("font-weight",  "bolder");
                driverLabel.setAttribute("stroke-width",  options.labelStrokeWidth);
                driverLabel.setAttribute("stroke",  options.labelStrokeColor);
                driverLabel.setAttribute("text-anchor",  "middle");
                driverLabel.textContent = driver;
                that.svg.appendChild(driverLabel);
                labels[driver] = driverLabel; // store label for quicker lookup
            } else {
                // this driver has previously been drawn, set visibility and new co-ords
                circle.setAttribute('display','inline');
                circle.setAttribute("cx", pointOfDriver.x);
                circle.setAttribute("cy", pointOfDriver.y);
                driverLabel = labels[driver];
                driverLabel.setAttribute('display','inline');
                driverLabel.setAttribute("x", pointOfDriver.x);
                driverLabel.setAttribute("y", pointOfDriver.y + (options.nodeSize/4) - options.labelVertOffset);
            } 
        }
        
        function hideDriver(driver) {
            circle = nodes[driver];
            driverLabel = labels[driver];
            circle.setAttribute('display','none');
            driverLabel.setAttribute('display','none');
        }

        function getPointAt(percent) {   
            // needed because returning a SVGPoint at length 0 returns an incorrect coordinate pair.
            if(percent === 0) {
                percent += 0.0001;
            }	
            return path.getPointAtLength((trackLength/100) * percent);
        }

        /**
         * Private function to clone the external telemData object, protecting from external data changes
         */
        function cloneTelemData() {
            var clonedTelemData = {}
            for(var driver in rawTelemData){
                clonedTelemData[driver] = rawTelemData[driver];
            }
            return clonedTelemData;
        }

        function getRandomColor() {
            var letters = '0123456789ABCDEF'.split('');
            var color = '#';
            for (var i = 0; i < 6; i++ ) {
                color += letters[Math.round(Math.random() * 15)];
            }
            return color;
        }

        /**
         * Private function to provide a color, first by taken from the preset list of colors and thereafter by generating a new color.
         */
        function getColor() {
            if(colors.length < 1) {
                return getRandomColor()
            } else {
                return colors.shift();
            }
        }  
        
        /**
	     * Public function to schedule a position update to be applied over 'duration' milliseconds
         */ 
        this.updatePositions = function(epoc) {
            var newData = cloneTelemData();            
            var now = Date.now();
            var duration = 0;
            
            var msSinceLastUpdate = now - lastUpdateTime;
            // throw out updates with tiny durations
	    if(msSinceLastUpdate < fastestUpdateRateSupported) {
	        //console.log("dropping update " + msSinceLastUpdate);
	        return;
	    } 
	    
            var msNewData;            
            if(typeof epoc === "undefined") epoc = Date.now();            
            if(typeof lastProcessedEpoc === 'undefined') {
                var msNewData = msSinceLastUpdate;
            } else {
                var msNewData = epoc - lastProcessedEpoc;  
            } 
            //console.log(msSinceLastUpdate + " msSinceLastUpdate " + msNewData + " msNewData");
            //console.log("current buffer " + buffer + " (predicting? " + predicting + ")");
            lastPredictionDuration = buffer;  // keep track of duration of the last prediction period 
            
            // we have a red flag
            if(redFlag > 0) {
                buffer = 0;
                msSinceLastUpdate = msNewData;
                awaitingFirstUpdate = true;
                redFlag = 0;
            }            
            
            // reduce duration to account for predicted movement
            if(buffer < 0) {
                duration += buffer;
                msNewData += buffer;                
                if(msNewData < 0) {
                    //console.log("expired update, dropping : " + msNewData);
                    return;
                }   
                buffer = 0;
            }
            
            // process this update
            lastUpdateTime = now;
            lastProcessedEpoc = epoc; 
	    
            // if this is our first update extend the duration 
            if(awaitingFirstUpdate) {
                msSinceLastUpdate += options.initialBuffer;
                //console.log("minimum latency is " + msSinceLastUpdate);
                awaitingFirstUpdate = false;
            }	    
            //console.log("update received, time since last update " + msSinceLastUpdate + ", currentBuffer " + buffer);

            duration += msSinceLastUpdate;         
            //console.log("duration " + duration + ", msNewData " + msNewData);

            if(duration <= 0) {
                //console.log("!!! DURATION " + duration);
                duration = 1;	
            }
            updateQueue.push({
                               "data" : newData,
                               "duration" : duration
                             });    
            buffer += duration;
            //console.log("newBuffer " + buffer);
                        
            processNextUpdate(); 
        }         
       
        /**
         * Private function to attempt the next set of position updates.  Does nothing if an update is in progress, otherwise processes
         * the oldest update on the queue.
         */
        var currentUpdate;
        var updateInProgress = false;
        function processNextUpdate() {  
            if(lastPredictionDuration < -50) {
                // last update involved prediction, make sure the next prediction is capped to avoid making predicted movements from previously predicted data (bad!)
                predictionCatchupRate = predictionCatchupRateSlow;
            } else {
                predictionCatchupRate = predictionCatchupRateFast; // last data was good so the prediction will be more accurate
            }
            predicting = false;
            if(updateInProgress) { 
                return; 
            }            
            currentUpdate = updateQueue.shift(); // try the next update
            if(currentUpdate == undefined) {
                //console.log("OUT OF UPDATES, WAITING!");
                return;    // no more updates to process
            }
            //console.log("starting update, buffer is " + buffer);
            updateInProgress = true;
            currentUpdate.expires = Date.now() + currentUpdate.duration;   
            if(options.maxPrediction > 0) currentUpdate.expires -= 17; // if prediction is enabled, remove one frame to account
                                                                       // for rendering overhead.  This keeps map synced to the incoming data updates. 
            telemData = currentUpdate.data;    // update telemData with latest update            
            
            /**
            for(var driver in telemData) {
                if(lastTelemData[driver] > telemData[driver]) {                    
                    if(!telemData[driver] > 10) {
                    console.log("COLLISION! - driver already at " + lastTelemData[driver] + " and should only be at " + telemData[driver] + " at the end of " + currentUpdate.duration + " seconds!!");
                    }
                }
            }     
            */
            
            // hide any drivers missing from the latest telemData
            for(var driver in lastTelemData) {
                if(telemData[driver] === undefined) {
                    hideDriver(driver);
                    delete lastTelemData[driver];
                }                    
            }             
            var percentChange;
            for(var driver in telemData) {
                // if a new driver has appeared, add to map
                if(lastTelemData[driver] === undefined) {
	    	        addDriverToTracker(driver);
                }                
                percentChange = telemData[driver] - lastTelemData[driver];
	            // when a node crosses the start/finish beam their progress updates from ~99% to >0%, potentially a large negative change.
	            // To avoid moving the node backwards to their new point we add 100 so that the animation continues in the correct direction
	            // However, if the negative change is not large enough to reflect a new lap crossing it represents a car moving backwards, so
	            // we DO want to draw the node moving backwards.  As long as the negative movement is not larger than 20% in one update cycle
	            // we will draw the car moving backwards.
                if(percentChange < -20) percentChange += 100;
                if(percentChange > 90) percentChange -= 100; // if a car moves backwards across the S/F line for some reason the percentChange will be a huge positive jump
                percentChangePerMs[driver] = percentChange / currentUpdate.duration;   
                
                /**
               
                if(percentChangePerMs[driver] > 0.002) {
                    percentChangePerMs[driver] = 0.002;                
                } else if(percentChangePerMs[driver] < -0.002) {
		    percentChangePerMs[driver] = -0.002;                
                }
                */
                
                /**
		if(lastPredictionDuration < -50) {
			if(percentChangePerMs[driver] < 0) percentChangePerMs[driver] = 0.001;
		}
		*/
                
                //console.log(currentUpdate.duration + "    " + percentChangePerMs[driver]);
            }        
        }                
            
        var time;
        var predicting = false;
		
        /**
         * The main rendering thread, continously running.  Uses the requestAnimationFrame API to allow for native optimisation if the browser allows it
         */
        (function drawFrame() {   
            requestAnimationFrame(drawFrame); // queue up the next frame    
            
            var now = Date.now();
            var dt = now - (time || now);
            // console.log("dt is " + dt + ", buffer is " + buffer);
            time = now;
            
            if(currentUpdate == undefined) {
                // there is no current update, nothing to draw
                return;
            }              
            buffer -= dt; // reduce buffer for this update  
            if(now >= currentUpdate.expires) {
                //console.log("currentUpdate has expired, " + updateQueue.length + " updates queued, " + buffer + " buffer time remaining");
                updateInProgress = false;    // allow the next update to be processed
                if(updateQueue.length > 0) {
                    // process the queued update immediately                    
                    processNextUpdate();       
                } else {
                    // predict the node movement for the configurable duration
                    predicting = true;
                    updateBufferStatusDot("#FFCC00");
                    //console.log("PREDICTING MOVEMENT FOR THE NEXT (MS)" + ((currentUpdate.expires + options.maxPrediction) - now));
                    if(now >= (currentUpdate.expires + options.maxPrediction)) {
                        predicting = false;                        
                        //console.log("OUT OF PREDICTION TIME!");
                        // prediction period over with no updates - stop all animation
                        currentUpdate = undefined;
                        redFlag = now;
                        updateBufferStatusDot('#FF0000');
                        return;
                    }
                }
            } 
            if(!predicting) updateBufferStatusDot("#00FF00");	    	    
	    for(var driver in telemData) {
                circle = nodes[driver];
                driverLabel = labels[driver];
		if(typeof percentChangePerMs[driver] == "undefined") continue; // no historical data for this driver
		
		// cap movement rate in predicted phase
		/**
		if(predicting) {
		    if(percentChangePerMs[driver] < 0) {
		        percentChangePerMs[driver] = 0;
		    } else if(percentChangePerMs[driver] > 0.001) {
		        percentChangePerMs[driver] = 0.001;
		    }
		}
		*/		
		
                var amountToMoveThisUpdate = percentChangePerMs[driver] * dt;
                if(predicting) {                
                    if(amountToMoveThisUpdate < 0) {
                        continue; // don't move backwards in a predicting phase
                    } else {
                        amountToMoveThisUpdate *= predictionCatchupRate; // if we are predicting the node movement in the absence of real data, slow down the movements to avoid moving too far (which would require a negative adjustment on the next update)
                    }                    
                }
                if(desiredPercentPos === 0) continue; // skip doing any work if there are no changes to apply
                var desiredPercentPos = lastTelemData[driver] + amountToMoveThisUpdate;
                if (desiredPercentPos > 100) desiredPercentPos -= 100;
                if (desiredPercentPos < 0) desiredPercentPos += 100;  
                var newPoint = getPointAt(desiredPercentPos);                
                circle.setAttribute("cx", newPoint.x);
                circle.setAttribute("cy", newPoint.y);
                driverLabel.setAttribute("x", newPoint.x);
                driverLabel.setAttribute("y", newPoint.y + (options.nodeSize/4) - options.labelVertOffset);
                lastTelemData[driver] = desiredPercentPos; 
	    } 
	    
        })();
       
        function updateBufferStatusDot(color) {
            if(!options.reportBufferStatus) return;
            if(color === bufferStatusColor) return; // don't change color if it is already correct;
            nodes["dot"].setAttribute("fill",color); 
            bufferStatusColor = color;
        }
        
        this.setNodeColor = function(driver, color) {
            nodes[driver].setAttribute("fill",color);
        }

        this.setNodeStrokeColor = function(driver, color) {
            nodes[driver].setAttribute("stroke", color);
        }

        this.setNodeStrokeWidth = function(driver, width) {
            nodes[driver].setAttribute("stroke-width", width);
        }

        this.setNodeStrokeDash = function(driver) {
            nodes[driver].setAttribute("stroke-dasharray","3,4");
        }
        
        this.setLabelColor = function(driver, color) {
            labels[driver].setAttribute("fill",color);
        }
        
        /*
         * Public function to reset track to its initial state.
         */
        this.resetBuffer = function() {
            redFlag = Date.now();
            updateBufferStatusDot('#FF0000');
        }
    }
    return RivalTracker;
}());

