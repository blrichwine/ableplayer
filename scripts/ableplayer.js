/* 
  // JavaScript for Able Player 
  
  // HTML5 Media API: 
  // http://www.w3.org/TR/html5/embedded-content-0.html#htmlmediaelement
  // W3C API Test Page: 
  // http://www.w3.org/2010/05/video/mediaevents.html
  
  // Uses JW Player as fallback 
  // JW Player configuration options: 
  // http://www.longtailvideo.com/support/jw-player/28839/embedding-the-player
  // (NOTE: some options are not documented, e.g., volume) 
  // JW Player API reference: 
  // http://www.longtailvideo.com/support/jw-player/28851/javascript-api-reference
  
*/

/*jslint node: true, browser: true, white: true, indent: 2 */
/*global $, jQuery */
"use strict";

// Construct an AblePlayer object 
// Parameters are: 
// mediaId - the id attribute of the <audio> or <video> element 
// umpIndex - the index of this Able Player instance (if page includes only one player, umpIndex = 0) 
// startTime - the time at which to begin playing the media       
function AblePlayer(mediaId, umpIndex, startTime) {

  /* 
   *
   * USER DEFINED VARIABLES
   *
   */

  // Debug - set to true to write messages to console; otherwise false
  this.debug = false;

  // Volume range is 0 to 1. Don't crank it to avoid overpowering screen readers
  this.volume = 0.5;

  // Default video height and width 
  // Can be overwritten with height and width attributes on HTML <video> element
  this.videoWidth = 480;
  this.videoHeight = 360; 

  // Button color 
  // Media controller background color can be customized in ump.css 
  // Choose 'white' if your controller has a dark background, 'black' if a light background
  // Use a contrast checker to ensure your color scheme has sufficient contrast
  // e.g., http://www.paciellogroup.com/resources/contrastAnalyser
  this.buttonColor = 'white';

  // Browsers that don't support seekbar sliders will use rewind and forward buttons 
  // seekInterval = Number of seconds to seek forward or back with these buttons    
  this.seekInterval = 10;

  // In UMP's predecessor (AAP) progress sliders were included in supporting browsers 
  // However, this results in an inconsistent interface across browsers 
  // most notably, Firefox as of 16.x still did not support input[type="range"] (i.e., sliders)
  // The following variable can be used in the future to add conditional slider support if desired
  // Note that the related code has not been updated for UMP. 
  // Therefore, this should NOT be set to true at this point. 
  this.useSlider = false;
  
  // showNowPlaying - set to true to show 'Now Playing:' plus title of current track above player 
  // Otherwise set to false 
  // This is only used when there is a playlist 
  this.showNowPlaying = true;

  // fallback - set to 'jw' if implementation includes JW Player as fallback 
  // JW Player is licensed separately 
  // JW Player files must be included in thirdparty folder 
  // JW Player will be loaded as needed in browsers that don't support HTML5 media 
  // No other fallback solution is supported at this time
  // If NOT using JW Player, set to false. An error message will be displayed if browser can't play the media.  
  this.fallback = 'jw'; 
  
  // testFallback - set to true to force browser to use the fallback player (for testing)
	// Note: JW Player does not support offline playback (a Flash restriction)
	// Therefore testing must be performed on a web server 
  this.testFallback = false;
     
  // loop - if true, will start again at top after last item in playlist has ended
  // NOTE: This is not fully supported yet - needs work 
  this.loop = true; 

  /* 
   *
   * END USER DEFINED VARIABLES
   *
   */

  // if F12 Developer Tools aren't open in IE (through 9, no longer a problen in IE10)
  // console.log causes an error - can't use debug without a console to log messages to 
  if (! window.console) { 
    this.debug = false;
  }

  if (this.debug) {    
    console.log('initalizing player with mediaId ' + mediaId);  
  }

  if (mediaId) { 
    this.mediaId = mediaId;   
    if (umpIndex) {
      this.umpIndex = umpIndex;
    }
    else { 
      this.umpIndex = 0;
    }
    if (startTime) { 
      this.startTime = startTime; 
    }
    else { 
      this.startTime = 0;
    }
    if (this.debug && startTime > 0) { 
      console.log('Will start media at ' + startTime + ' seconds');
    }
    this.startedPlaying = false;

    // be sure media exists, and is a valid type       
    if ($('#' + mediaId)) { 
      // an element exists with this mediaId
      this.$media = $('#' + mediaId); // jquery object 
      this.media = this.$media[0]; // html element
      if (this.$media.is('audio')) { 
        this.mediaType = 'audio';
      }
      else if (this.$media.is('video')) { 
        this.mediaType = 'video';
      }
      else { 
        this.mediaType = this.$media.get(0).tagName;
        if (this.debug) { 
          console.log('You initialized Able Player with ' + mediaId + ', which is a ' + this.mediaType + ' element.'); 
          console.log('Able Player only works with HTML audio or video elements.');
        }
      }

      if (this.mediaType === 'audio' || this.mediaType === 'video') { 
      
        // get data from source elements
        this.$sources = this.$media.find('source');       
        if (this.debug) { 
          console.log('found ' + this.$sources.length + ' media sources');
        }

        // get playlist for this media element   
        this.getPlaylist();
        
        // determine which player can play media, and define this.player 
        this.getPlayer(); 

        if (this.player) {

          // do a bunch of stuff to setup player 
          this.getDimensions();
          this.getPrefs();
          this.injectPlayerCode();          
          this.setButtons();
          this.setupAlert();
          this.initPlaylist();
        
          // initialize player to support captions &/or description (from track elements)
          this.initTracks();
        
          // initialize description based on available sources + user prefs 
          this.initDescription(); 
      
          this.initializing = false;
        
       
          if (this.player == 'html5') { 
            if (this.initPlayer('html5')) { 
              this.addControls(this.mediaType);  
              this.addEventListeners();
            }
          }
          else if (this.player === 'jw') { 
            // attempt to load jwplayer script
            var thisObj = this;
            $.getScript('thirdparty/jwplayer.js') 
              .done(function( script, textStatus ) {
                if (thisObj.debug) {
                  console.log ('Successfully loaded the JW Player');
                }
                if (thisObj.initPlayer('jw')) { 
                  thisObj.addControls(thisObj.mediaType);  
                  thisObj.addEventListeners();
                }
              })
              .fail(function( jqxhr, settings, exception ) {
                if (thisObj.debug) { 
                  console.log ("Unable to load JW Player.");
                }
                thisObj.player = null;
                return;
              });
          }
          if (this.debug && this.player) { 
            console.log ('Using the ' + this.player + ' media player');
          }
        }        
        else { 
          // no player can play this media
          this.provideFallback(); 
        }
      } // end if mediaId matches an audio or video element 
      else { 
        if (this.debug) {
          console.log('The element with id ' + mediaId + ' is a ' + this.mediaType + ' element.');
          console.log('Expecting an audio or video element.'); 
        }        
      } 
    } // end if no media is found that matches mediaId 
    else { 
      if (this.debug) {
        console.log('No media was found with an id of ' + mediaId + '.'); 
      }
    }
  } //end if media ID was passed to object
  else { 
    if (this.debug) {
      console.log('Able Player is missing a required parameter (media ID).'); 
    }
  }
} 
AblePlayer.prototype.getPlayer = function() { 

  // Determine which player to use, if any 
  // return 'html5', 'jw' or null 
  
  var i, sourceType, $jwSource;
  if (this.testFallback || (this.isUserAgent('msie 9') && this.mediaType === 'video')) {
    // the user wants to test the fallback player, or  
    // the user is using IE9, which has buggy implementation of HTML5 video 
    // e.g., plays only a few seconds of MP4 than stops and resets to 0
    // even in native HTML player with no JavaScript 
    // Couldn't figure out a solution to this problem - IE10 fixes it. Meanwhile, use JW for IE9 video 
    if (this.fallback === 'jw') {            
      // be sure JW Player can play the provided source 
      // until confirmed, set this.player = null
      this.player = null;
      if (this.$sources.length > 0) { // this media has one or more <source> elements
        for (i = 0; i < this.$sources.length; i++) { 
          sourceType = this.$sources[i].getAttribute('type'); 
          if ((this.mediaType === 'video' && sourceType === 'video/mp4') || 
            (this.mediaType === 'audio' && sourceType === 'audio/mpeg')) { 
              // JW Player can play this 
              this.player = 'jw';
              this.mediaFile = this.$sources[i].getAttribute('src');
              return;
          }
        }
      }
      else if (this.playlistSize > 0) { 
        // see if the first item in the playlist is a type JW player an play 
        var $newItem = this.$playlist.eq(0);
        // check data-* attributes for a type JW can play  
        if (this.mediaType === 'audio') { 
          if ($newItem.attr('data-mp3')) { 
            this.player = 'jw';
            this.mediaFile = $newItem.attr('data-mp3'); 
            return;
          }
        }
        else if (this.mediaType === 'video') {
          if ($newItem.attr('data-mp4')) { 
            this.player = 'jw';
            this.mediaFile = $newItem.attr('data-mp4'); 
            return;
          }
        }
      }
      else { 
        // there is no source, nor playlist 
        this.player = null;
      }
    }
    else { 
      this.player = null;
    }
  }
  else if (this.media.canPlayType) {
    this.player = 'html5';
  }
  else { 
    this.player = null;
  }
}
AblePlayer.prototype.injectPlayerCode = function() { 

  // create and inject surrounding HTML structure 
  this.$mediaContainer = this.$media.wrap('<div class="ump-media-container"></div>').parent();         
  this.$umpDiv = this.$mediaContainer.wrap('<div class="ump"></div>').parent();

  this.$playerDiv = $('<div>', {
    'class' : 'ump-player',
    'role' : 'region',
    'aria-label' : this.mediaType + ' player'
  });
  this.$playerDiv.addClass('ump-'+this.mediaType);

  // The default skin depends a bit on a Now Playing div 
  // so go ahead and add one 
  // However, it's only populated if this.showNowPlaying = true 
  this.$nowPlayingDiv = $('<div>',{
    'class' : 'ump-now-playing',
    'role' : 'alert'
  });

  this.$controllerDiv = $('<div>',{
    'class' : 'ump-controller'
  });

  this.$statusBarDiv = $('<div>',{
    'class' : 'ump-status-bar'
  });
  this.$timer = $('<span>',{
    'class' : 'ump-timer'
  });
  this.$status = $('<span>',{
    'class' : 'ump-status',
    'role' : 'alert'
  });
  this.$statusBarDiv.append(this.$timer).append(this.$status);

  // append new divs to $playerDiv
  this.$playerDiv.append(this.$nowPlayingDiv, this.$controllerDiv, this.$statusBarDiv);

  // and finally, append $playerDiv to umpDiv 
  this.$umpDiv.append(this.$playerDiv);
        
  // oh, anb also add div for displaying alerts and error messages 
  this.$alertDiv = $('<div>',{
    'class' : 'ump-alert',
    'role' : 'alert'
  });   
  this.$umpDiv.after(this.$alertDiv);
}
AblePlayer.prototype.initTracks = function() { 
       
  // check for tracks (e.g., captions, description)
  this.$tracks = this.$media.find('track'); 
  if (this.$tracks.length > 0) { 
    if (this.mediaType === 'video') { 
      // add container that captions or description will be appended to
      // Note: new Jquery object must be assigned _after_ wrap, hence the temp vidcapContainer variable  
      var vidcapContainer = $('<div>',{ 
        'class' : 'ump-vidcap-container'
      });
      this.$vidcapContainer = this.$mediaContainer.wrap(vidcapContainer).parent();  
    }
    // UMP currently only supports one caption and one description track 
    for (var i=0; i<this.$tracks.length; i++) { 
      var track = this.$tracks[i];
      var kind = track.getAttribute('kind');
      if (kind === 'captions') { 
        this.hasCaptions = true;
        // create a div for displaying captions  
        // includes aria-hidden="true" because otherwise 
        // captions being added and removed causes sporadic changes to focus in JAWS
        // (not a problem in NVDA or VoiceOver)
        this.$captionDiv = $('<div>',{
          'class': 'ump-captions',
          'aria-hidden': 'true' 
        });
        this.$vidcapContainer.append(this.$captionDiv);
        this.captions = []; //temp array for storing data from source file
        this.currentCaption = -1;
        if (this.prefCaptions === 1) { 
          // user wants to see captions
          this.captionsOn = true; 
        }
        else { 
          this.captionsOn = false;
        }
        this.captionsStarted = false; 
        // go ahead and setup captions in case they're needed 
        // even if user doesn't want to see them 
        this.setupTimedText('captions',track);
      }
      else if (kind === 'descriptions') {
        // prepare closed description, even if user doesn't prefer it 
        // this way it's available if needed 
        this.hasClosedDesc = true;
        // create a div for exposing description
        // description will be exposed via role="alert" & announced by screen readers  
        this.$descDiv = $('<div>',{
          'class': 'ump-descriptions',
          'role': 'alert'
        });
        if (this.prefClosedDesc === 0 || this.prefVisibleDesc === 0) { 
          this.$descDiv.addClass('ump-clipped');                
        }
        this.$umpDiv.append(this.$descDiv); 
        this.description = []; //temp array for storing data from source file
        this.currentDescription = -1;
        if ((this.prefDesc === 1) && (this.prefClosedDesc === 1)) { 
          this.closedDescOn = true; 
        }
        this.setupTimedText('description',track);
      }
      else if (kind === 'subtitles') { 
        // not yet supported
      }
      else if (kind === 'chapters') { 
        // not supported
      }
      else if (kind === 'metadata') { 
        // not supported
      }
    }
  }
}
AblePlayer.prototype.getPlaylist = function() { 

  // find a matching playlist and set this.hasPlaylist
  // if there is one, also set this.$playlist, this.$playlistSize, this.$playlistIndex, & this.$playlistEmbed

  this.hasPlaylist = false; // will change to true if a matching playlist is found

  var thisObj = this;
  $('.ump-playlist').each(function() { 
    if ($(this).attr('data-player') === thisObj.mediaId) { 
      // this is the playlist for the current player 
      thisObj.hasPlaylist = true;        
      thisObj.$playlist = $(this).find('li');
      // add tabindex to each list item 
      thisObj.$playlist.attr('tabindex','0');
      thisObj.playlistSize = thisObj.$playlist.length;
      thisObj.playlistIndex = 0;        
      var dataEmbedded = $(this).attr('data-embedded');
      if (typeof dataEmbedded !== 'undefined' && dataEmbedded !== false) {
        // embed playlist within player 
        thisObj.playlistEmbed = true;             
      }
      else { 
        thisObj.playlistEmbed = false;
      }
    }
  }); 
}
AblePlayer.prototype.initPlaylist = function() { 
  if (this.playlistEmbed === true) { 
    // move playlist into player, immediately before statusBarDiv
    this.$playlist.parent().insertBefore(this.$statusBarDiv);          
  }
  if (this.hasPlaylist && this.$sources.length === 0) { 
    // no source elements were provided. Construct them from the first playlist item
    this.initializing = true;
    this.swapSource(0);       
    // redefine this.$sources now that media contains one or more <source> elements
    this.$sources = this.$media.find('source');       
    if (this.debug) { 
      console.log('after initializing playlist, there are ' + this.$sources.length + ' media sources');
    }
  } 
}
AblePlayer.prototype.initPlayer = function(player) { 

  // player is either 'html' or 'jw' 
  // might ultimately support others too, e.g., 'youtube' 
  
  var poster, $jwSource, jwHeight, captionFile, i, sourceType;            

  // set the default volume  
  if (player === 'html5') { 
    this.media.volume = this.volume;
  }
  else if (player === 'jw') { 
    // Default is 1 to 10, but JW Player uses 0 to 100 for volume. Need to convert
    this.volume = this.volume * 100; 
  }      

  // get vars from HTML5 code, and use them to initialize jwplayer 
  if (this.mediaType === 'video') {
    poster = this.$media.attr('poster');
  }
 
  if (player == 'jw') {
    // remove the media element - we're done with it
    // keeping it would cause too many potential problems with HTML5 & JW event listeners both firing
    this.$media.remove();           

    // add an id to div.ump-media-container (JW Player needs this) 
    this.jwId = this.mediaId + '_fallback';            
    this.$mediaContainer.attr('id',this.jwId);

    if (this.mediaType === 'audio') { 
      // JW Player always shows its own controls if height <= 40 
      // Must set height to 0 to hide them 
      // My bug report: 
      // http://www.longtailvideo.com/support/forums/jw-player/setup-issues-and-embedding/29814
      jwHeight = '0px';   
    }
    if (this.mediaType === 'video') { 
      this.jwPlayer = jwplayer(this.jwId).setup({
        file: this.mediaFile,
        flashplayer: 'thirdparty/jwplayer.flash.swf',
        html5player: 'thirdparty/jwplayer.html5.js',
        image: poster, 
        controls: false,
        volume: this.volume,
        height: this.videoHeight,
        width: this.videoWidth,
        fallback: false, 
        primary: 'flash',
        wmode: 'transparent' // necessary to get HTML captions to appear as overlay 
      });               
    }
    else { // if this is an audio player
      this.jwPlayer = jwplayer(this.jwId).setup({
        file: this.mediaFile,
        flashplayer: 'thirdparty/jwplayer.flash.swf',
        html5player: 'thirdparty/jwplayer.html5.js',
        controls: false,
        volume: this.volume,
        height: jwHeight,
        fallback: false, 
        primary: 'flash'
      });                             
    }
  }

  // get media duration 
  if (player === 'html5') {
    this.duration = this.media.duration;
  }
  else { // jw player
    this.duration = jwplayer(this.jwId).getDuration();        
  }
  
  // synch elapsedTime with startTime      
  this.elapsedTime = this.startTime;
        
  // If there's a transcript and user wants to make it tabbable, do that now
  if (this.prefTabbable === 1) { 
    if ($('.ump-transcript').length > 0) { 
      $('.ump-transcript span').attr('tabindex','0');
    }       
  }     

  // define mediaFile, descFile, and hasOpenDesc 
  for (i = 0; i < this.$sources.length; i++) {
    sourceType = this.$sources[i].getAttribute('type');
    if (this.media.canPlayType(sourceType)) {
      this.mediaFile = this.$sources[i].getAttribute('src'); 
      this.descFile = this.$sources[i].getAttribute('data-desc-src');       
      if (this.descFile) { 
        this.hasOpenDesc = true;         
      }
      else { 
        this.hasOpenDesc = false;
      }
    }
  }
        
  // If using open description (as determined previously based on prefs & availability) 
  // swap media file now 
  this.initializing = true;
  if (this.openDescOn === true) { 
    this.swapDescription();
  }
  this.initializing = false;
  
  if (this.mediaType === 'video') { 
    // Eventually add support for synchronized sign language video 
    this.hasSignLanguage = false; //if true, adds a non-functional button to control bar 
  }     
  return true;  
} 
AblePlayer.prototype.provideFallback = function() { 
          
  // provide ultimate fallback for users with no HTML media support, nor JW Player support 
  // this could be links to download the media file(s) 
  // but for now is just a message   
  
  var msg, width, height, msgContainer; 
  
  msg = 'Sorry, your browser is unable to play this ' + this.mediaType + '. ';
  var msgContainer = $('<div>',{
    'class' : 'ump-fallback',
    'role' : 'alert'
  });
  this.$media.before(msgContainer);     
  msgContainer.text(msg);  
}
AblePlayer.prototype.getDimensions = function() { 
  // override default dimensions with width and height attributes of media element, if present
  if (this.$media.attr('width')) { 
    this.videoWidth = this.$media.attr('width');
    if (this.$media.attr('height')) { 
      this.videoHeight = this.$media.attr('height');
    }
  }
}
AblePlayer.prototype.setButtons = function() { 
  this.playButtonImg = 'images/media-play-' +  this.buttonColor + '.png';
  this.pauseButtonImg = 'images/media-pause-' +  this.buttonColor + '.png';
  this.rewindButtonImg = 'images/media-rewind-' +  this.buttonColor + '.png';
  this.forwardButtonImg = 'images/media-forward-' +  this.buttonColor + '.png';
  this.slowerButtonImg = 'images/media-slower-' +  this.buttonColor + '.png';
  this.fasterButtonImg = 'images/media-faster-' +  this.buttonColor + '.png';
  this.muteButtonImg = 'images/media-mute-' +  this.buttonColor + '.png';
  this.volumeButtonImg = 'images/media-volume-' +  this.buttonColor + '.png';
  this.volumeUpButtonImg = 'images/media-volumeUp-' +  this.buttonColor + '.png';
  this.volumeDownButtonImg = 'images/media-volumeDown-' +  this.buttonColor + '.png';
  this.ccButtonImg = 'images/media-cc-' +  this.buttonColor + '.png';
  this.descriptionButtonImg = 'images/media-description-' +  this.buttonColor + '.png';
  this.signButtonImg = 'images/media-sign-' +  this.buttonColor + '.png';
  this.fullscreenButtonImg = 'images/media-fullscreen-' +  this.buttonColor + '.png';
  this.settingsButtonImg = 'images/settings/media-settings-' +  this.buttonColor + '.png';
  this.helpButtonImg = 'images/settings/media-help-' +  this.buttonColor + '.png';
}
AblePlayer.prototype.initDescription = function() { 

  // set default mode for delivering description (open vs closed) 
  // based on availability and user preference        

  // first, check to see if there's an open-described version of this video  
  // checks only the first source 
  // Therefore, if a described version is provided, 
  // it must be provided for all sources  
  this.descFile = this.$sources.first().attr('data-desc-src');
  if (this.descFile) { 
    if (this.debug) {
      console.log('This video has a described version: ' + this.descFile);      
    }
    this.hasOpenDesc = true;             
  }
  else { 
    if (this.debug) {
      console.log('This video does not have a described version');      
    }
    this.hasOpenDesc = false;              
  } 
  // now compare prefs with available sources  
  if (this.prefDesc === 1) { 
    // user prefers description 
    if (this.hasOpenDesc === true && this.hasClosedDesc === true) { 
      // both open and closed description are available. 
      if (this.prefClosedDesc === 1) { 
        // user prefers closed description 
        this.useDescType = 'closed';
        this.openDescOn = false;
        this.closedDescOn = true;
      }
      else { 
        this.useDescType = 'open';
        this.openDescOn = true;
        this.closedDescOn = false;
      }
    }
    else if (this.hasOpenDesc === true) { 
      // only open description is available
      this.useDescType = 'open';
      this.openDescOn = true;
      this.closedDescOn = false;
    }
    else if (this.hasClosedDesc === true) { 
      // only closed description is available 
      if (this.prefClosedDesc === 1) { 
        this.useDescType = 'closed';
        this.openDescOn = false;
        this.closedDescOn = true;
      }
      else { 
        // user does not want closed description
        this.useDescType = null;
        this.openDescOn = false;
        this.closedDescOn = false;
      }
    }
    else { 
      // no description is available
      this.useDescType = null;
      this.openDescOn = false;
      this.closedDescOn = false;
    }
  }
  else { 
    // user does not prefer description 
    this.useDescType = null;
    this.openDescOn = false;
    this.closedDescOn = false;
  }
  if (this.debug) { 
    this.debugDescription();
  }
}
AblePlayer.prototype.addPrefsForm = function() { 

  // define all the parts
  var prefsDiv = $('<div>',{ 
    'class': 'ump-prefs-form',
    role: 'form'
  });
  var introText = "<p>Saving your preferences requires cookies.</p>\n";
    
  var prefsIntro = $('<p>',{ 
    html: introText
  });
  if (this.mediaType === 'video') { 
    // currently only video has a Features fieldset 
    var featuresFieldset = $('<fieldset>');
    var featuresLegend = $('<legend>Features</legend>');      
    featuresFieldset.append(featuresLegend);  
  }
  var keysFieldset = $('<fieldset>');
  var keysLegend = $('<legend>Modifier Keys</legend>');       
  keysFieldset.append(keysLegend);  

  for (var i=0; i<this.prefs.length; i++) { 
    var thisPref = this.prefs[i]['name'];
    var thisDiv = $('<div>');
    var thisId = this.mediaId + '_' + thisPref;   
    var thisLabel = $('<label for="' + thisId + '"> ' + this.prefs[i]['label'] + '</label>');
    var thisCheckbox = $('<input>',{
      type: 'checkbox',
      name: thisPref,
      id: thisId,
      value: 'true'
    });
    thisDiv.append(thisCheckbox).append(thisLabel);
    // check current active value for this preference 
    if (this[thisPref] === 1) { 
      thisCheckbox.prop('checked',true);
    }     
    if (i === 0 || i === 1) { // this is a key preference
      keysFieldset.append(thisDiv);     
    }
    else { // this is a feature preference
      featuresFieldset.append(thisDiv);
    }     
  }
  // Now assemble all the parts   
  prefsDiv
    .append(prefsIntro)
    .append(keysFieldset);
  if (this.mediaType === 'video') { 
    prefsDiv
      .append(featuresFieldset);
  }         
  this.$umpDiv.append(prefsDiv); 

  // initiate form as a JQuery-UI dialog 
  // documentation: http://api.jqueryui.com/dialog 
  var thisObj = this;
  $( ".ump-prefs-form" ).dialog({ 
    autoOpen: false,
    buttons: [
      { 
        text: 'Save',
        click: function() { 
          thisObj.savePrefs(); 
          $(this).dialog('close');
        }
      },
      {
        text: 'Cancel',
        click: function() { 
          $(this).dialog('close');
        }
      }
    ],
    closeOnEscape: true,
    dialogClass: 'ump-prefs-dialog',
    draggable: true,
    modal: true,
    resizable: true,
    title: 'Preferences',
    width: '32em'
  });
}
AblePlayer.prototype.addHelp = function() {   
  // create help text that will be displayed in a JQuery-UI dialog 
  // if user clicks the Help button   
  var helpText = "<p>The media player on this web page can be operated ";
  helpText += "from anywhere on the page using the following keystrokes:</p>\n";
  helpText += "<ul>\n";
  for (var i=0; i<this.controls.length; i++) { 
    if (this.controls[i] === 'play') { 
      var label = 'Play/Pause';
      var key = 'p </b><em>or</em><b> spacebar';
    }
    else if (this.controls[i] === 'stop') { 
      var label = 'Stop';
      var key = 's';
    }
    else if (this.controls[i] === 'rewind') { 
      var label = 'Rewind ' + this.seekInterval + ' seconds';
      var key = 'r';
    }
    else if (this.controls[i] === 'forward') { 
      var label = 'Forward' + this.seekInterval + ' seconds';;
      var key = 'f';
    }
    else if (this.controls[i] === 'mute') { 
      var label = 'Mute';
      var key = 'm';
    }
    else if (this.controls[i] === 'volumeUp') { 
      var label = 'Volume Up';
      var key = 'u </b><em>or</em><b> 1-5';
    }
    else if (this.controls[i] === 'volumeDown') { 
      var label = 'Volume Down';
      var key = 'd </b><em>or</em><b> 1-5';
    }
    else if (this.controls[i] === 'cc') { 
      var label = 'Toggle captions';
      var key = 'c';
    }
    else if (this.controls[i] === 'desc') { 
      var label = 'Toggle narration (description)';
      var key = 'n';
    }
    else if (this.controls[i] === 'settings') { 
      var label = 'Settings';
      var key = 't';
    }
    else if (this.controls[i] === 'help') { 
      var label = 'Help';
      var key = 'h';
    }
    else { 
      var label = false;
    }
    if (label) { 
      helpText += '<li><b><span class="ump-help-modifiers">'; 
      if (this.prefAltKey === 1) { 
        helpText += 'Alt + ';
      }
      if (this.prefCtrlKey === 1) { 
        helpText += 'Control + ';
      }
      helpText += '</span>' + key + "</b> = " + label + "</li>\n";
    }
  }
  helpText += "</ul>\n";
  helpText += "<p>Note that modifier keys (Alt and Control) can be assigned ";
  helpText += "within <em>Preferences</em>. "; 
  helpText += "Also, support for shortcut keys has been thoroughly tested in Firefox ";
  helpText += "but might be buggy in other browsers. ";
  helpText += "We hope to improve this soon so that it works more reliably across all browsers.</p>";

  var helpDiv = $('<div>',{ 
    'class': 'ump-help-div',
    'html': helpText
  });
  this.$umpDiv.append(helpDiv); 
    
  // initiate as a JQuery-UI dialog 
  // documentation: http://api.jqueryui.com/dialog 
  $('.ump-help-div').dialog({ 
    autoOpen: false,
    buttons: [{ 
      text: 'ok',
      click: function() { 
        $(this).dialog('close');
      }
    }],
    closeOnEscape: true,
    dialogClass: 'ump-help-dialog',
    draggable: true,
    modal: true,
    resizable: true,
    title: 'Help',
    width: '32em'
  });
}
AblePlayer.prototype.setCookie = function(cookieValue) { 
  if ($.isFunction($.cookie)) { 
    // set cookie that expires in 90 days 
    $.cookie('Able-Player',cookieValue,90);  
  }
}
AblePlayer.prototype.getCookie = function() { 
  if ($.isFunction($.cookie)) { 
    return $.cookie('Able-Player');
  }
}
AblePlayer.prototype.getPrefs = function() { 

  // defines the User Preferences array and set default user variables 
  // get prefs from cookie if one exists; otherwise use defaults 
  // store prefs to cookie for future reference
  
  this.prefs = [];

  // modifier keys preferences apply to both audio and video 
  this.prefs[0] = [];
  this.prefs[0]['name'] = 'prefAltKey'; // use alt key with shortcuts 
  this.prefs[0]['label'] = 'Alt key';
  this.prefs[0]['default'] = 0; // off because currently not capturing this reliably across all browsers

  this.prefs[1] = [];
  this.prefs[1]['name'] = 'prefCtrlKey'; // use ctrl key with shortcuts
  this.prefs[1]['label'] = 'Control key';
  this.prefs[1]['default'] = 0;  // // off because currently not capturing this reliably across all browsers

  if (this.mediaType === 'video') { // features prefs apply only to video

    this.prefs[2] = [];
    this.prefs[2]['name'] = 'prefCaptions'; // closed captions default state 
    this.prefs[2]['label'] = 'Closed captions on by default';
    this.prefs[2]['default'] = 1; // on because many users can benefit

    this.prefs[3] = [];
    this.prefs[3]['name'] = 'prefDesc'; // audio description default state 
    this.prefs[3]['label'] = 'Description on by default';
    this.prefs[3]['default'] = 0; // off because users who don't need it might find it distracting

    this.prefs[4] = [];
    this.prefs[4]['name'] = 'prefClosedDesc'; // use closed description if available
    this.prefs[4]['label'] = 'Use text-based description if available';
    this.prefs[4]['default'] = 0; // off because experimental

    this.prefs[5] = [];
    this.prefs[5]['name'] = 'prefVisibleDesc'; // visibly show closed description (if avilable and used)
    this.prefs[5]['label'] = 'If using text-based description, make it visible';
    this.prefs[5]['default'] = 1; // on because sighted users probably want to see this cool feature in action 

    this.prefs[6] = [];
    this.prefs[6]['name'] = 'prefHighlight'; // highlight transcript as video plays
    this.prefs[6]['label'] = 'Highlight transcript as video plays';
    this.prefs[6]['default'] = 1; // on because many users can benefit

    this.prefs[7] = [];
    this.prefs[7]['name'] = 'prefTabbable'; // tab-enable transcript 
    this.prefs[7]['label'] = 'Keyboard-enable transcript';
    this.prefs[7]['default'] = 0; // off because if users don't need it, it impedes tabbing elsewhere on the page
  }
    
  // see if user has prefs stored in a cookie   
  var cookieLength = this.prefs.length;
  var cookie = this.getCookie();
  if (typeof cookie === 'string') { 
    if (cookie.length === cookieLength) { 
      for (var i=0; i<cookieLength; i++) { 
        var thisPref = this.prefs[i]['name'];
        var thisValue = parseInt(cookie.substr(i,1)); // cookie is a sting ("1" or "0"), convert to integer
        // the following defines all pref variables, e.g., this.prefCaptions, this.prefDesc 
        this[thisPref] = thisValue; 
      }
    }
    else { // cookie is wrong size. Use defaults
      var cookie = false;
    }
  }
  if (!cookie) { 
    var cookie = '';
    for (var i=0; i<this.prefs.length; i++) { 
      var thisPref = this.prefs[i]['name'];
      var defaultValue = this.prefs[i]['default'];
      cookie += defaultValue;
      this[thisPref] = defaultValue; 
    }
    this.setCookie(cookie);     
  }
}
AblePlayer.prototype.savePrefs = function() { 
  // called when user saves the Preferences form
  // update cookie with new value 
  var numChanges = 0;
  var cookie = '';
  for (var i=0; i<this.prefs.length; i++) {
    var thisPref = this.prefs[i]['name'];
    if ($('input[name="' + thisPref + '"]').is(':checked')) { 
      cookie += '1';
      if (this[thisPref] === 1) { 
        // nothing has changed 
      }
      else { 
        // user has just turned this pref on  
        this[thisPref] = 1;
        numChanges++;
      }     
    }
    else { // thisPref is not checked
      cookie += '0';
      if (this[thisPref] === 1) { 
        // user has just turned this pref off 
        this[thisPref] = 0;
        numChanges++;
      }
      else { 
        // nothing has chaged
      }     
    }
  }
  if (numChanges > 0) {     
    this.setCookie(cookie);     
    // make changes to current envivoronment based on new prefs 

    // modifier keys (update help text) 
    if (this.prefAltKey === 1) { 
      var modHelp = 'Alt + ';
    }
    else { 
      var modHelp = '';
    }
    if (this.prefCtrlKey === 1) { 
      modHelp += 'Control + ';
    }
    $('.ump-help-modifiers').text(modHelp);     

    // description visibility 
    if (this.prefVisibleDesc === 1) { 
      $('.ump-descriptions').removeClass('ump-clipped');      
    }
    else { 
      $('.ump-descriptions').addClass('ump-clipped');     
    }
    this.showAlert('Your changes have been saved.');
      
    // tabbable transcript 
    if (this.prefTabbable === 1) { 
      $('.ump-transcript span').attr('tabindex','0');     
    } 
    else { 
      $('.ump-transcript span').removeAttr('tabindex');
    }
  } 
  else { 
    this.showAlert("You didn't make any changes.");   
  }
}
AblePlayer.prototype.setupAlert = function() { 
  // setup JQuery hidden dialog in which to show alert messages via showAlert()
  this.$alertBox = $('#ump-alert').dialog({
    autoOpen: false,
    buttons: [{
      text: 'ok', 
      click: function() { 
        $(this).dialog("close");
      }
    }],
    closeOnEscape: true,
    dialogClass: 'ump-alert-dialog',
    draggable: true,
    modal: false,
    resizable: false,
    title: 'Done.',
    width: '20em'
  });
}
AblePlayer.prototype.showAlert = function(msg) { 
  // show alert message in jQuery dialog
  this.$alertBox.text(msg).dialog('open');
}
AblePlayer.prototype.isUserAgent = function(which) {
  var userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.indexOf(which) != -1) {
    return true;
  } 
  else {
    return false;
  }
}
AblePlayer.prototype.addEventListeners = function() { 

  // Save the current object context in thisObj for use with inner functions.
  var thisObj = this;
    
  // handle clicks on player buttons 
  this.$controllerDiv.find('input').click(function(){  
    var whichButton = $(this).attr('class').substr(4);
    if (whichButton === 'play') { 
      thisObj.handlePlay();
    }
    else if (whichButton === 'stop') { 
      thisObj.handleStop();
    }
    else if (whichButton === 'rewind') { 
      thisObj.handleRewind();
    }
    else if (whichButton === 'forward') { 
      thisObj.handleForward();        
    }
    else if (whichButton === 'mute') { 
      thisObj.handleMute();
    }
    else if (whichButton === 'volumeUp') { 
      thisObj.handleVolume('up');
    }
    else if (whichButton === 'volumeDown') { 
      thisObj.handleVolume('down');
    }
    else if (whichButton === 'faster') { // experimental. Not currently used
      thisObj.handleSpeed('faster');
    }
    else if (whichButton === 'slower') { // experimental. Not currently used
      thisObj.handleSpeed('slower');
    }     
    else if (whichButton.substr(0,2) === 'cc') { 
      thisObj.handleCaptionToggle();
    }
    else if (whichButton.substr(0,4) === 'desc') { 
      thisObj.handleDescriptionToggle();
    }
    else if (whichButton.substr(0,4) === 'sign') { 
      // not yet supported
    }
    else if (whichButton === 'settings') { 
      thisObj.handleSettingsClick();
    }
    else if (whichButton === 'help') { 
      thisObj.handleHelpClick();
    }
  });
    
  // handle keystrokes (using DHTML Style Guide recommended key combinations) 
  // http://dev.aol.com/dhtml_style_guide/#mediaplayer
  // Modifier keys Alt + Ctrl are on by default, but can be changed within Preferences
  // NOTE #1: Style guide only supports Play/Pause, Stop, Mute, Captions, & Volume Up & Down
  // The rest are reasonable best choices  
  // NOTE #2: If there are multiple players on a single page, keystroke handlers 
  // are only bound to the FIRST player 
  if (this.umpIndex === 0) { 
    $(window).keypress(function(e) {    
      if (e.which === 32) { // spacebar = play/pause
        thisObj.handlePlay();
      }
      else if (e.which === 112) { // p = play/pause        
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handlePlay();
        }
      }
      else if (e.which === 115) { // s = stop 
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleStop();
        }
      }
      else if (e.which === 109) { // m = mute 
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleMute();
        }
      }
      else if (e.which === 117) { // u = volume up 
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleVolume('up');
        }
      }
      else if (e.which === 100) { // d = volume down 
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleVolume('down');
        }
      }
      else if (e.which >= 49 && e.which <= 53) { // set volume 1-5
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleVolume(e.which);
        }
      }
      else if (e.which === 99) { // c = caption toggle 
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleCaptionToggle();      
        }
      }
      else if (e.which === 102) { // f = forward 
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleForward();
        }
      }
      else if (e.which === 114) { // r = rewind (could use B for back???) 
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleRewind();
        }
      }
      else if (e.which === 110) { // n = narration (description)
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleDescriptionToggle();
        }
      }     
      else if (e.which === 104) { // h = help
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleHelpClick();
        }
      }     
      else if (e.which === 116) { // t = seTTings
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleSettingsClick();
        }
      }     
      else if (e.which === 104) { // h = help
        if (thisObj.usingModifierKeys(e)) { 
          thisObj.handleHelpClick();
        }
      }     
      else if (e.which === 13) { // Enter 
        var thisElement = $(document.activeElement);
        if (thisElement.prop('tagName') === 'SPAN') { 
          // register a click on this SPAN 
          // if it's a transcript span the transcript span click handler will take over
          thisElement.click();
        }
        else if (thisElement.prop('tagName') === 'LI') { 
          thisElement.click();
        }
      }
    });
  }
    
  // handle clicks on playlist items
  if (this.$playlist) {
    this.$playlist.click(function() { 
      thisObj.playlistIndex = $(this).index();
      thisObj.swapSource(thisObj.playlistIndex);  
    });
  }
    
  // handle clicks on text within transcript 
  // Note #1: Only one transcript per page is supported
  // Note #2: Pressing Enter on an element that is not natively clickable does NOT trigger click() 
  // Forcing this elsewhere, in the keyboard handler section  
  if ($('.ump-transcript').length > 0) {  
    $('.ump-transcript span').click(function() { 
      var spanStart = $(this).attr('data-start');
      if (thisObj.player === 'html5') { 
        thisObj.seekTo(spanStart);
      }
      else { 
        // jw player 
        jwplayer(thisObj.jwId).seek(spanStart);
      }
    });
  }

  // add listeners for media events 
  if (this.player === 'html5') {
    // NOTE: iOS does not support autoplay, 
    // and no events are triggered until media begins to play 
    this.$media
      .on('emptied',function() { 
        if (thisObj.debug) { 
          console.log('media has been emptied');        
        }
      })        
      .on('loadedmetadata',function() {
        if (thisObj.debug) {
          console.log('meta data has loaded');  
        }
        //should be able to get duration now
        if (this.useSlider) {
          // the following AAP code has not been updated for UMP
          // It's preserved here for reference in case UMP supports sliders in the future
          if (!isNaN(thisObj.audio.duration)) { 
            thisObj.duration = thisObj.audio.duration;
          }
          if (thisObj.duration > 0) {
            thisObj.updateTime(thisObj.duration, thisObj.durationContainer, thisObj.rangeSupported);
            if (thisObj.rangeSupported) {
              thisObj.seekBar.setAttribute('min', 0);
              thisObj.seekBar.setAttribute('max', thisObj.duration);
            }
          }
          thisObj.toggleSeekControls('on');
          // end code that has not been updated
        }
        if (thisObj.swappingSrc === true) { 
          // new source file has just been loaded 
          // should be able to play 
          thisObj.media.play();
          thisObj.$status.text('Playing');        
          thisObj.swappingSrc = false; // swapping is finished                      
          thisObj.$playpauseButton.attr('title','Pause').attr('src',thisObj.pauseButtonImg); 
          if (thisObj.$descButton) { 
            if (thisObj.openDescOn || thisObj.closedDescOn) { 
              thisObj.$descButton.removeClass('buttonOff').attr('title','Turn off description');
            }
            else { 
              thisObj.$descButton.addClass('buttonOff').attr('title','Turn on description');            
            }
          }
        }
      })
      .on('canplay',function() { 
        if (thisObj.startTime && !thisObj.startedPlaying) { 
          thisObj.seekTo(thisObj.startTime);
        }
      })
      .on('canplaythrough',function() { 
        if (thisObj.startTime && !thisObj.startedPlaying) { 
          // try again, if seeking failed on canplay
          thisObj.seekTo(thisObj.startTime);
        }
      })
      .on('playing',function() { 
        thisObj.$status.text('Playing'); 
      })
      .on('ended',function() { 
        thisObj.$status.text('End of track'); 
        thisObj.updateTime('current',0);
        // reset play button
        thisObj.$playpauseButton.attr('title','Play').attr('src',thisObj.playButtonImg);
        // if there's a playlist, advance to next item and start playing  
        if (thisObj.hasPlaylist) { 
          if (thisObj.playlistIndex === (thisObj.playlistSize - 1)) { 
            // this is the last track in the playlist
            if (thisObj.loop) { 
              thisObj.playlistIndex = 0;              
              thisObj.swapSource(0);
            }             
          }
          else { 
            // this is not the last track. Play the next one. 
            thisObj.playlistIndex++;
            thisObj.swapSource(thisObj.playlistIndex)
          }
        }
      })
      .on('waiting',function() { 
        thisObj.$status.text('Waiting'); // same as buffering???  
      })
      .on('durationchange',function() { 
        thisObj.updateTime('duration',thisObj.media.duration);
      })
      .on('timeupdate',function() { 
        if (thisObj.startTime && !thisObj.startedPlaying) { 
          // try seeking again, if seeking failed on canplay or canplaythrough
          thisObj.seekTo(thisObj.startTime);
        }       
        thisObj.updateTime('current',thisObj.media.currentTime);
        if (thisObj.captionsOn) { 
          thisObj.showCaptions();
        }
        if (thisObj.closedDescOn && thisObj.useDescType === 'closed') { 
          thisObj.showDescription();
        }
        if (thisObj.prefHighlight === 1) {
          thisObj.highlightTranscript(thisObj.media.currentTime); 
        }
      })
      .on('play',function() { 
        if (thisObj.debug) { 
          console.log('media play event');        
        }
      })
      .on('pause',function() { 
        if (thisObj.debug) { 
          console.log('media pause event');       
        }
      })
      .on('ratechange',function() { 
        if (thisObj.debug) { 
          console.log('media ratechange');        
        }
      })
      .on('volumechange',function() { 
        if (thisObj.debug) { 
          console.log('media volume change');       
        }
      })
      .on('error',function() { 
        if (thisObj.debug) { 
          switch (thisObj.media.error.code) { 
            case 1: 
              console.log('HTML5 Media Error: MEDIA_ERR_ABORTED');
              break;
            case 2: 
              console.log('HTML5 Media Error: MEDIA_ERR_NETWORK ');
              break;
            case 3: 
              console.log('HTML5 Media Error: MEDIA_ERR_DECODE ');
              break;
            case 4: 
              console.log('HTML5 Media Error: MEDIA_ERR_SRC_NOT_SUPPORTED ');
              break;
          }
        }
      });
  }
  else { 
    // add listeners for JW Player events 
    jwplayer(thisObj.jwId)
      .onTime(function() {
        if (this.getState() === 'IDLE') { 
          // necessary to force this to 0 
          // Otherwise, when user presses Stop button JW Player rewinds to 0 
          // and current time tends to show descending time values, but never reaches 0
          thisObj.updateTime('current',0);  
        }
        else { 
          thisObj.updateTime('current',this.getPosition()); 
        }
        // get and set duration, if it hasn't already been set 
        // ideally this would happen when .onMeta() is fired 
        // i.e., before media starts playing 
        // So far no luck getting onMeta() to fire though 
        if (typeof thisObj.duration === 'undefined' || thisObj.duration === -1) { 
          thisObj.duration = this.getDuration();
          if (thisObj.duration > 0) { 
            thisObj.updateTime('duration',thisObj.duration); 
          }
        }
        // show captions 
        // We're doing this ourself because JW Player's caption support is not great 
        // e.g., there's no way to toggle JW captions via the JavaScript API  
        if (thisObj.captionsOn) { 
          thisObj.showCaptions();
        }
        // show description 
        // Using our own description solutions rather than JW Player's MP3 solution 
        // JW's solution, though innovative, doesn't seem to be a high priority for JW devlopers
        if (thisObj.closedDescOn) { 
          thisObj.showDescription();
        }
        // show highlight in transcript 
        if (thisObj.prefHighlight === 1) {
          thisObj.highlightTranscript(this.getPosition()); 
        }
      })
      .onComplete(function() {          
        thisObj.$status.text('End of track'); 
        thisObj.updateTime('current',0);
        //reset play button
        thisObj.$playpauseButton.attr('title','Play').attr('src',thisObj.playButtonImg);
        // if there's a playlist, advance to next item and start playing  
        if (thisObj.hasPlaylist) { 
          if (thisObj.playlistIndex === (thisObj.playlistSize - 1)) { 
            // this is the last track in the playlist
            if (thisObj.loop) { 
              thisObj.playlistIndex = 0;              
              thisObj.swapSource(0);
            }             
          }
          else { 
            // this is not the last track. Play the next one. 
            thisObj.playlistIndex++;
            thisObj.swapSource(thisObj.playlistIndex)
          }
        }
      })
      .onReady(function() { 
        if (thisObj.debug) { 
          console.log('JW Player onReady event fired');
        }
        // remove JW Player from tab order. 
        // We don't want users tabbing into the Flash object and getting trapped
        $('#' + thisObj.jwId).removeAttr('tabindex'); 

        if (thisObj.startTime > 0) { 
          // UMP has been initialized with a startTime 
          // e.g., from a search result or link in a transcript
          // ONE TIME ONLY - set currentTime to startTime and begin playing
          if (!thisObj.startedPlaying) {          
            // JW Player doesn't download media until it's needed  
            // Therefore, can't seek() until video has started playing 
            // This is why seek() works with Forward and Back buttons, but not with startTime 
            // The following is a hack: Start and immediately stop the player. 
            // This triggers a media download, which enables seek() to work. 
            // http pseudo-streaming would probably be a better solution, but isn't supported yet...
            // jwplayer(thisObj.jwId).play(true);
            // jwplayer(thisObj.jwId).play(false);
            // jwplayer(thisObj.jwId).seek(thisObj.startTime);
            thisObj.startedPlaying = true;
          }
        }
      })
      .onSeek(function(event) { 
        // this is called when user scrubs ahead or back 
        // but not when seek() is called - OR IS IT???
        // After the target offset is reached, JW Player automatically plays media at that point  
        if (thisObj.debug) { 
          console.log('Seeking to ' + event.position + '; target: ' + event.offset);          
        }
      })
      .onPlay(function() { 
        if (thisObj.debug) { 
          console.log('JW Player onPlay event fired');
        }
        thisObj.$status.text('Playing'); 
      })
      .onPause(function() { 
        if (thisObj.debug) { 
          console.log('JW Player onPause event fired');
        }       
        thisObj.$status.text('Paused'); 
      })
      .onBuffer(function() { 
        if (thisObj.debug) { 
          console.log('JW Player onBuffer event fired');
        }       
        thisObj.$status.text('Buffering'); 
      })
      .onIdle(function(e) { 
        if (thisObj.debug) { 
          console.log('JW Player onIdle event fired');
        }
        thisObj.$status.text('Stopped'); // Idle?
      })
      .onMeta(function() { 
        if (thisObj.debug) { 
          console.log('JW Player onMeta event fired');
        }       
        // NOTE: onMeta() never fires.
        if (this.getDuration() > 0) { 
          thisObj.duration = this.getDuration();
          thisObj.updateTime('duration',thisObj.duration); 
        }
      })
      .onPlaylist(function() { 
        if (thisObj.debug) { 
          console.log('JW Player onPlaylist event fired');
        }       
        // onPlaylist is fired when a new playlist is loaded into the player 
        // A playlist includes any new media source 
        if (thisObj.swappingSrc === true) { 
          // new source file has just been loaded 
          thisObj.updateTime('duration',thisObj.media.duration);
          // _might_ be able to get duration of new source
          // if not, getDuration returns -1
          thisObj.duration = this.getDuration();
          if (thisObj.duration > 0) { 
            thisObj.updateTime('duration',thisObj.duration);  
          }
          // should be able to play 
          jwplayer(thisObj.jwId).play(true);
          thisObj.$status.text('Playing');        
          thisObj.swappingSrc = false; // swapping is finished                      
          thisObj.$playpauseButton.attr('title','Pause').attr('src',thisObj.pauseButtonImg); 
          if (thisObj.$descButton) { 
            if (thisObj.openDescOn || thisObj.closedDescOn) { 
              thisObj.$descButton.removeClass('buttonOff').attr('title','Turn off description');
            }
            else { 
              thisObj.$descButton.addClass('buttonOff').attr('title','Turn on description');            
            }
          }
        }
      });
  }   
}
AblePlayer.prototype.addControls = function() {   
  // determine which controls to show based on several factors: 
  // mediaType (audio vs video) 
  // availability of tracks (e.g., for closed captions & audio description) 
  // browser support (e.g., for sliders and speedButtons) 
  // user preferences (???)      
  // some controls are aligned on the left, and others on the right 
    
  var leftControls = ['play','stop','rewind','forward'];  
  if (this.$media.playbackRate) {     
    // browser supports playbackRate! 
    // so far, confirmed that Chrome 23.x supports faster playback without sound (i.e., fast forward)
    // IE 9 and Opera 12.1 support faster playback (with sound!)  
    // Firefox 13.x does not support it at all 
    // No browser supports slower playback (unless I'm misunderstanding this feature)
    // According to the HTML5 spec: 
    // "If the effective playback rate is positive or zero, then the direction of playback is forwards. "
    // "Otherwise, it is backwards." 
    // So, I'm concluding that no browsers support backwards playback 
    var useSpeedButtons = false; // until better understood &/or supported, not using
  }
  else { 
    var useSpeedButtons = false;
  }
  if (useSpeedButtons) { 
    leftControls.push('slower'); 
    leftControls.push('faster');
  }
    
  var rightControls = [];
  if (this.mediaType === 'video') { 
    if (this.hasCaptions) {
      rightControls.push('cc'); //closed captions
    }
    if (this.hasOpenDesc || this.hasClosedDesc) { 
      rightControls.push('description'); //audio description 
    }
    if (this.hasSignLanguage) { 
      rightControls.push('sign'); // sign language
    }
  }
  if (!(this.isUserAgent('iphone') || this.isUserAgent('ipad'))) { 
    // iphones and ipads don't support HTML5 audio volume control
    // (confirmed true as of iOS 5.1)
    // so don't display volume-related buttons
    rightControls.push('mute');
    rightControls.push('volumeUp');
    rightControls.push('volumeDown'); 
  }
  if (this.mediaType === 'video') { 
    var useFullScreen = false; // set to true if browser supports full screen (need to work on this)
    if (useFullScreen) { 
      rightControls.push('fullscreen');       
    }
  }
  rightControls.push('settings');
  // create the hidden form that will be triggered by a click on the Settings button
  this.addPrefsForm();        

  rightControls.push('help');

  // now step separately through left and right controls
  var totalWidth = 0;
  for (var i=1; i<=2; i++) {
    var hPos = 0; // horizontal position
    if (i ==1) {        
      var controls = leftControls;
      var controllerSpan = $('<span>',{
        'class': 'ump-left-controls'
      });
    }
    else { 
      var controls = rightControls;
      var controllerSpan = $('<span>',{
        'class': 'ump-right-controls'
      });
    }     
    for (var j=0; j<controls.length; j++) { 
      var control = controls[j];
      if (control === 'seek') { 
        this.addSeekControls(hPos);
        if (this.useSlider) {
          if (this.rangeSupported) { 
            hPos += sliderWidth;
          }
        }
      }
      else { 
        // this control is a button 
        var buttonTitle = this.getButtonTitle(control); 
        if (control === 'mute') { 
          var buttonImg = this.volumeButtonImg;
        }
        else { 
          var buttonImg = 'images/media-' + control + '-' + this.buttonColor + '.png';
        }
        var newButton = $('<input>',{ 
          type: 'image',
          // alt: buttonTitle, 
          title: buttonTitle,
          style: 'left:' + hPos + 'px',
          value: '',
          src: buttonImg,
          'class': 'ump-' + control 
        });         
        if (control === 'cc') { 
          if (!this.prefCaptions || this.prefCaptions != 1) { 
            // captions are available, but user has them turned off 
            newButton.addClass('buttonOff').attr('title','Turn on captions');
          }
        }
        else if (control === 'description') {      
          if (!this.prefDesc || this.prefDesc != 1) { 
            // user prefer non-audio described version 
            // Therefore, load media without description 
            // Description can be toggled on later with this button  
            newButton.addClass('buttonOff').attr('title','Turn on description');              
          }         
        }
          
        controllerSpan.append(newButton);
        // create variables of buttons that are referenced throughout the class 
        if (control === 'play') { 
          this.$playpauseButton = newButton;
        }
        else if (control === 'cc') { 
          this.$ccButton = newButton;
        }
        else if (control === 'description') {        
          this.$descButton = newButton; 
          // gray out description button if description is not active 
          if (!(this.openDescOn || this.closedDescOn)) {  
            this.$descButton.addClass('buttonOff').attr('title','Turn on description');
          }
        }
        else if (control === 'mute') { 
          this.$muteButton = newButton;
        }
        hPos += 34; // button width + 1px border + 1px margin
      }
    }
    if (i === 1) { // left controls 
      controllerSpan.css('left',0);       
    }
    else { // right controls
      var rightPos = hPos + 2;
      controllerSpan.css('right',rightPos+'px');
    }
    this.$controllerDiv.append(controllerSpan);
    totalWidth += hPos;
  }
  if (this.mediaType === 'video') { 
    // set controller to width of video
    var controllerStyles = {
      'width': this.videoWidth+'px',
      'height': this.videoHeight+'px'
    } 
    this.$umpDiv.css(controllerStyles); 
    // also set width and height of div.ump-vidcap-container
    var vidcapStyles = {
      'width': this.videoWidth+'px',
      'height': this.videoHeight+'px'
    }     
    if (this.$vidcapContainer) { 
      this.$vidcapContainer.css(vidcapStyles); 
    }   
    // also set width of the captions and descriptions containers 
    if (this.$captionDiv) { 
      this.$captionDiv.css('width',this.videoWidth+'px');
    }
    if (this.$descDiv) {
      this.$descDiv.css('width',this.videoWidth+'px');
    }
  }
  else { 
    // set controller to combined width of all controls
    // plus 10px separation between left and right controls
    totalWidth += 10;
    this.$umpDiv.css('width',totalWidth+'px'); 
  }
    
  // also add a timer to the status bar
  this.$elapsedTimeContainer = $('<span>',{
    'class': 'ump-elapsedTime',
    text: '0:00'
  });
  this.$durationContainer = $('<span>',{
    'class': 'ump-duration'
  }); 
  this.$timer.append(this.$elapsedTimeContainer).append(this.$durationContainer);       
  // populate duration if known
  this.updateTime('duration',this.duration);  
    
  // combine left and right controls arrays for future reference 
  this.controls = leftControls.concat(rightControls);

  // construct help dialog that includes keystrokes for operating the included controls 
  this.addHelp();     
}
AblePlayer.prototype.handlePlay = function(e) { 
  if (this.player === 'html5') {       
    if (this.media.paused || this.media.ended) { 
      this.media.play();
      this.$status.text('Playing');
      // change play button to pause button
      this.$playpauseButton.attr('title','Pause').attr('src',this.pauseButtonImg);
    } 
    else { 
      // audio is playing. Pause it
      this.media.pause(); 
      this.$status.text('Paused');
      // change pause button to play button
      this.$playpauseButton.attr('title','Play').attr('src',this.playButtonImg);
    }
  }
  else { 
    // jw player
    var playerState = jwplayer(this.jwId).getState();
    if (playerState === 'IDLE' || playerState === 'PAUSED') { 
      jwplayer(this.jwId).play(); 
      // change play button to pause button
      this.$playpauseButton.attr('title','Pause').attr('src',this.pauseButtonImg);
    }
    else { // playerState is 'PLAYING' or 'BUFFERING'. Pause it
      jwplayer(this.jwId).pause(); 
      // change pause button to play button
      this.$playpauseButton.attr('title','Play').attr('src',this.playButtonImg);
    }
  } 
}
AblePlayer.prototype.handleStop = function() { 
  if (this.player === 'html5') {             
    // reset media
    this.media.pause(); 
    this.media.currentTime = 0;
  }
  else { 
    // jw player
    jwplayer(this.jwId).stop(); // unloads the currently playing media file
  }     
  // reset timer text (same code for both players)
  this.elapsedTime = 0;
  this.updateTime('current',0); 
  this.$status.text('Stopped');
  // change pause button to play button
  this.$playpauseButton.attr('title','Play').attr('src',this.playButtonImg);  
}
AblePlayer.prototype.handleRewind = function() { 
  if (this.player === 'html5') {             
    var targetTime = this.media.currentTime - this.seekInterval;    
    if (targetTime < 0) {
      this.media.currentTime = 0;
    }
    else {
      this.media.currentTime = targetTime;
    }
  }
  else { 
    // jw player                    
    var targetTime = jwplayer(this.jwId).getPosition() - this.seekInterval;     
    if (targetTime < 0) {
      jwplayer(this.jwId).seek(0);
    }
    else {
      jwplayer(this.jwId).seek(targetTime);
    }
  } 
}
AblePlayer.prototype.handleForward = function() { 
  if (this.player === 'html5') {             
    var targetTime = this.media.currentTime + this.seekInterval;    
    if (targetTime > this.duration) {
      // targetTime would advance beyond the end. Just advance to the end.
      this.media.currentTime = this.duration;
    }
    else {
      this.media.currentTime = targetTime;
    }
  }
  else { 
    // jw player                    
    var targetTime = jwplayer(this.jwId).getPosition() + this.seekInterval;     
    if (targetTime > this.duration) {
      // targetTime would advance beyond the end. Just advance to the end.
      jwplayer(this.jwId).seek(this.duration);
    }
    else {
      jwplayer(this.jwId).seek(targetTime);
    }
  } 
}
AblePlayer.prototype.handleMute = function() { 
  if (this.player === 'html5') {             
    if (this.media.muted) { // unmute
      this.media.muted = false; 
      // change image on mute button
      this.$muteButton.attr('title','Mute').attr('src',this.volumeButtonImg);
      // restore volume to its previous setting
      this.media.volume = this.volume;
    }
    else { // mute 
      this.media.muted = true; 
      // change mute button
      this.$muteButton.attr('title','UnMute').attr('src',this.muteButtonImg);
    }
  }
  else { 
    // jw player
    if (jwplayer(this.jwId).getMute()) { // true if muted. unmute
      jwplayer(this.jwId).setMute(false); 
      // change image on mute button
      this.$muteButton.attr('title','Mute').attr('src',this.volumeButtonImg);
      // restore volume to its previous setting
      jwplayer(this.jwId).setVolume(this.volume);
    }
    else { // mute 
      jwplayer(this.jwId).setMute(true); 
      // change mute button
      this.$muteButton.attr('title','UnMute').attr('src',this.muteButtonImg);
    }
  } 
}
AblePlayer.prototype.handleVolume = function(direction) {   
  // direction is either 'up', 'down' or an integer 1-5
  if (this.player === 'html5') {             
    // volume is a range between 0 and 1 
    // up and down increments/decrements by 0.1 
    if (direction === 'up') {    
      if (this.media.muted) { // unmute
        this.media.muted = false; 
        this.$muteButton.attr('title','Mute').attr('src',this.volumeButtonImg);
      }
      if (this.volume < 0.9) {        
        this.volume = Math.round((this.volume + 0.1) * 10) / 10;
      }
      else {
        this.volume = 1;
      }
      this.media.volume = this.volume;        
    }
    else if (direction === 'down') { 
      if (this.volume > 0.1) {        
        this.volume = Math.round((this.volume - 0.1) * 10) / 10;
      }
      else {
        this.volume = 0;
        this.media.muted = true;
        this.$muteButton.attr('title','UnMute').attr('src',this.muteButtonImg);
      }
    }
    else if (direction >= 49 || direction <= 53) { 
      this.volume = (direction-48) * 0.2;
    }
    this.media.volume = this.volume;        
  }
  else { 
    // jw player
    // volume is a range between 0 and 100 
    // up and down increments/decrements by 10 
    if (direction === 'up') {
      if (jwplayer(this.jwId).getMute()) { // currently muted. unmute
        jwplayer(this.jwId).setMute(false); 
        this.$muteButton.attr('title','Mute').attr('src',this.volumeButtonImg);
      }
      if (this.volume < 90) {       
        this.volume = this.volume + 10;
      }
      else {
        this.volume = 100;
      }         
    }
    else if (direction === 'down') { 
      if (this.volume > 10) {       
        this.volume = this.volume - 10;
      }
      else {
        this.volume = 0;
        jwplayer(this.jwId).setMute(true); 
        this.$muteButton.attr('title','UnMute').attr('src',this.muteButtonImg);
      }     
    }
    else if (direction >= 49 || direction <= 53) { 
      this.volume = (direction-48) * 20;
    }
    jwplayer(this.jwId).setVolume(this.volume);       
  }
}
AblePlayer.prototype.handleSpeed = function(direction) { 
  // playback speed is support by HTML5, but not supported well by browsers 
  // currently experimenting with this feature 
  if (direction === 'faster') { 
    var targetSpeed = this.media.playbackRate + 1;
  }
  else if (direction === 'slower') { 
    var targetSpeed = this.media.playbackRate - 1;
  }
  this.media.playbackRate = targetSpeed;
}
AblePlayer.prototype.handleCaptionToggle = function() { 
  if (this.captionsOn === true) { 
    // captions are on. Turn them off. 
    this.captionsOn = false;
    this.$captionDiv.hide();
    this.$ccButton.addClass('buttonOff').attr('title','Show captions');
  }
  else { 
    // captions are off. Turn them on. 
    this.captionsOn = true;
    this.$captionDiv.show();
    this.$ccButton.removeClass('buttonOff').attr('title','Hide captions');          
  }
}
AblePlayer.prototype.handleDescriptionToggle = function() { 

  if (this.debug) { 
    console.log('toggling description');
    this.debugDescription();
  }

  if (this.hasOpenDesc && this.hasClosedDesc) { 
    // both open and closed description are available. 
    if (this.prefClosedDesc === 1) { 
      // user prefers closed description 
      if (this.closedDescOn === true) { 
        // closed descriptions are on. Turn them off 
        this.closedDescOn = false;
        this.$descDiv.hide(); 
        this.$descButton.addClass('buttonOff').attr('title','Turn on description');       
      }
      else { 
        // closed descriptions are off. Turn them on 
        this.closedDescOn = true;
        this.$descDiv.show(); 
        this.$descButton.removeClass('buttonOff').attr('title','Turn off description');               
      }
    }
    else { 
      // user prefers open description, and it's available 
      if (this.openDescOn) { 
        // open description is on. Turn it off (swap to non-described video)
        // don't toggle this.openDescOn - that's handled by swapDescription()
        this.$descButton.addClass('buttonOff').attr('title','Turn on description');             
      }
      else { 
        // open description is off. Turn it on (swap to described version)
        // don't toggle this.openDescOn - that's handled by swapDescription()
        this.$descButton.removeClass('buttonOff').attr('title','Turn off description');                     
      }
      this.swapDescription();
    }
  }
  else if (this.hasOpenDesc) { 
    // only open description is available
    if (this.openDescOn) { 
       // open description is on. Turn it off (swap to non-described video)
      this. openDescOn = false;
      this.$descButton.addClass('buttonOff').attr('title','Turn on description');             
    }
    else { 
      // open description is off. Turn it on (swap to described version)
      this. openDescOn = true;
      this.$descButton.removeClass('buttonOff').attr('title','Turn off description');                     
    }
    this.swapDescription();
  } 
  else if (this.hasClosedDesc) { 
    // only closed description is available
    var useDescType = 'closed';
    if (this.closedDescOn === true) { 
      // closed descriptions are on. Turn them off 
      this.closedDescOn = false;
      this.$descDiv.hide(); 
      this.$descButton.addClass('buttonOff').attr('title','Turn on description');       
    }
    else { 
      // closed descriptions are off. Turn them on 
      this.closedDescOn = true; 
      this.$descDiv.show();      
      if (this.prefVisibleDesc === 1) { 
        this.$descDiv.removeClass('ump-clipped'); 
      } 
      this.$descButton.removeClass('buttonOff').attr('title','Turn off description');               
    }
  }
}
AblePlayer.prototype.handleSettingsClick = function() { 
  $('.ump-prefs-form').dialog('open');  
}
AblePlayer.prototype.handleHelpClick = function() { 
  $('.ump-help-div').dialog('open');
}
AblePlayer.prototype.addSeekControls = function(leftPos) { 
  if (this.useSlider) {
    var sliderWidth = 200;
    // the following code was updated for UMP, but is not currently used 

    // Don't display a slider in browsers that tell you they can handle it but really can't
    // Safari on iOS acknowledges seekBar.type = 'range', but displays it as a text input, not a slider
    // Chrome crashes if user moves the slider too rapidly
    if (this.isUserAgent('iphone') || this.isUserAgent('ipad') || this.isUserAgent('chromex')) {
      this.rangeSupported = false;
    }
    else { 
      // Check remaining browsers for range support
      var testRange = document.createElement('input');
      testRange.setAttribute('type','range');
      if (testRange.type === 'text') { 
        this.rangeSupported = false;      
      }
      else { 
        this.rangeSupported = true;
      }
    }
    if (this.rangeSupported) {
      this.seekBar = $('<input>',{
        type: 'range',
        'class': 'ump-seekbar',
        value: '0',
        step: 'any',
        width: sliderWidth,
        style: 'left:' + leftPos + 'px'
      });
      this.$controllerDiv.append(this.seekBar);      
    }
      
    // the following AAP code has not been updated for UMP
    // If used, would need to be incorporated into the above
    if (this.player === 'html5') {
      if (!isNaN(this.media.duration)) { 
        this.duration = Math.floor(this.media.duration);
      }
    } 
    // If duration is unknown, can't define the slider's max attribute yet
    if (isNaN(this.duration) || this.duration === 0) {
      if (this.player === 'html5') { 

        // chopped some stuff out here 
      
      } 
      else {
        // do the same for JW Player 
        // max will be set when duration is known
        // min can be set now
        if (this.rangeSupported) {
          this.seekBar.setAttribute('min', 0);
        }
      }
    }
    else { //duration is known
      if (this.rangeSupported) {
        this.seekBar.setAttribute('min', 0);
        this.seekBar.setAttribute('max', Math.floor(this.duration));
      }
      if (this.player === 'html5') { //duration is in seconds
        this.updateTime(this.duration, this.durationContainer, this.rangeSupported);
      } 
      else { 
        //duration is in ms & must be converted
        this.updateTime(this.duration / 1000, this.durationContainer, this.rangeSupported);
      }
      this.toggleSeekControls('on');
    }
    // end code that has not been updated for UMP
  }
    
  else { //if not useSlider
      
    // Add rewind and fast forward buttons (even if a slider is also shown)
    // These will be hidden from users who have sliders, but visible to users who don't
    // We still want them, even if hidden, so users can benefit from their keyboard functionality   
    this.seekBack = $('<input>',{ 
      type: 'image',
      src: 'images/media-rewind.gif',
      style: 'left:' + leftPos + 'px',
      value: '',
      title: this.getButtonTitle('rewind'),
      'class': 'ump-rewind' 
    });
    this.$controllerDiv.append(this.seekBack);
    leftPos += 34;
    this.seekForward = $('<input>',{ 
      type: 'image',
      src: 'images/media-forward.gif',
      style: 'left:' + leftPos + 'px',
      value: '',
      title: this.getButtonTitle('forward'),
      'class': 'ump-forward' 
    });
    this.$controllerDiv.append(this.seekForward);
    // initially, seekBar, seekBack, & seekForward should be disabled
    // they will be enabled once the duration of the media file is known
    this.toggleSeekControls('off');
    if (this.rangeSupported === true) { 
      // Invisible elements can still be controlled with keyboard
      this.seekBack.css('visibility','hidden');
      this.seekForward.css('visibility','hidden');
    }
  }
}
AblePlayer.prototype.getButtonTitle = function(control) { 
  if (control === 'playpause') { 
    return 'Play'; 
  }
  else if (control === 'rewind') { 
    return 'Rewind ' + this.seekInterval + ' seconds';
  }
  else if (control === 'forward') { 
    return 'Advance ' + this.seekInterval + ' seconds';
  }
  else if (control === 'cc') {  
    if (this.captionsOn) {
      return 'Hide captions';
    }
    else { 
      return 'Show captions';
    }
  }   
  else if (control === 'description') { 
    if (this.closedDescOn) {
      return 'Turn off description';
    }
    else { 
      return 'Turn on description';
    }
  }   
  else if (control === 'sign') { // not yet supported 
    return 'Sign language';
  }
  else if (control === 'volumeUp') { 
    return 'Volume Up';
  }   
  else if (control === 'volumeDown') { 
    return 'Volume Down';
  }
  else { 
    return control.charAt(0).toUpperCase() + control.slice(1);
  }   
}
AblePlayer.prototype.seekTo = function (newTime) { 
  this.startTime = newTime;
  // Check HTML5 media "seekable" property to be sure media is seekable to startTime
  var seekable = this.media.seekable;
  if (this.startTime > seekable.start(0) && this.startTime <= seekable.end(0)) { 
    // startTime is seekable. Seek to startTime, then start playing
    this.media.currentTime = this.startTime;          
    this.media.play(true);
    this.startedPlaying = true;
    // change play button to pause button
    this.$playpauseButton.attr('title','Pause').attr('src',this.pauseButton);     
  } 
}
AblePlayer.prototype.updateTime = function(whichTime, time) {
  // whichTime is either current (media.currentTime) or duration
  // both are expected to be in seconds
  if (isNaN(time)) { 
    // do nothing 
    // this function should be called again via event listeners 
    // when time is known (esp. duration, which might be unknown initially)
  }
  else { 
    var minutes = Math.floor(time / 60);
    var seconds = Math.floor(time % 60);
    if (seconds < 10) { 
      seconds = '0' + seconds;
    }
    if (whichTime === 'current') {
      this.$elapsedTimeContainer.text(minutes + ':' + seconds); 
    }
    else if (whichTime === 'duration') { 
      this.$durationContainer.text(' / ' + minutes + ':' + seconds); 
    }       
  }
}
AblePlayer.prototype.setupTimedText = function(kind,track) {  
  // Only supports timed text in VTT format
  var trackSrc = track.getAttribute('src');
  var trackLang = track.getAttribute('srclang');
  if (trackSrc) { 
    // create a temp div for holding track data
    var tempDiv = $('<div>',{ 
      style: 'display:none'
    });
    // Save the current object context in thisObj for use with inner functions.
    var thisObj = this; 

    // load  file and store captions into array 
    tempDiv.load(trackSrc, function (trackText, status, req) { 
      if (status === 'error') { 
        if (this.debug) {
          console.log ('error reading ' + kind + ' file:' + status);
        }
      }
      else {
        //stanardize on \n for eol character
        trackText = thisObj.strip(trackText.replace(/\r\n|\r|\n/g, '\n'));
        var cues = trackText.split('\n\n'); //creates an array
        for (var c in cues) {
          var cue = cues[c].split('\n');
          if(cue.length >=2) {
            var start = thisObj.strip(cue[0].split(' --> ')[0]);
            var end = thisObj.strip(cue[0].split(' --> ')[1]);
            var cueText = cue[1];
            if (cue.length > 2) {
              for (var i=2; i<cue.length;i++) { 
                cueText += '<br/>'+cue[i];
              }
            }
            if (typeof cueText !== 'undefined') {
              if (cueText.length > 1) { 
                start = thisObj.toSeconds(start);
                end = thisObj.toSeconds(end);
                if (kind === 'captions') { 
                  thisObj.captions.push({'start':start,'end':end,'text':cueText}); 
                }
                else if (kind === 'description') { 
                  thisObj.description.push({'start':start,'end':end,'text':cueText});                   
                }
              }
            }
          }
        }
      }
    });
  } 
  //done with temp div. Can remove it now. 
  tempDiv.remove(); 
}
AblePlayer.prototype.showCaptions = function() { 
  if (this.player === 'html5') {
    var now = this.media.currentTime;
  }
  else { // jw player
    var now = jwplayer(this.jwId).getPosition();
  }
  for (var c in this.captions) {
    if ((this.captions[c].start <= now) && (this.captions[c].end > now)) {      
      var thisCaption = c;
      break;
    }
  }
  if (typeof thisCaption !== 'undefined') {  
    if (!this.captionsStarted) { 
      //this is the first caption
      this.$captionDiv.show();
      this.captionsStarted = true;
    }     
    if (this.currentCaption != thisCaption) { 
      // it's time to load the new caption into the container div 
      this.$captionDiv.html(this.captions[thisCaption].text);       
      this.currentCaption = thisCaption;
    } 
  }
  else {     
    this.$captionDiv.html('');
    this.currentCaption = -1;
  } 
}
AblePlayer.prototype.showDescription = function() { 
  // there's a lot of redundancy between this function and showCaptions 
  // Trying to combine them ended up in a mess though. Keeping as is for now. 
  if (this.player === 'html5') {
    var now = this.media.currentTime;
  }
  else { // jw player
    var now = jwplayer(this.jwId).getPosition();
  }
  for (var d in this.description) {
    if ((this.description[d].start <= now) && (this.description[d].end > now)) {      
      var thisDescription = d;
      break;
    }
  }
  if (typeof thisDescription !== 'undefined') {  
    if (this.currentDescription != thisDescription) { 
      // load the new description into the container div 
      this.$descDiv.html(this.description[thisDescription].text);
      this.currentDescription = thisDescription;
      if (this.$descDiv.is(':hidden')) { 
        this.$descDiv.show();
      }
    } 
  }
  else {     
    this.$descDiv.html('');
    this.currentDescription = -1;
  } 
}
AblePlayer.prototype.swapDescription = function() { 
  // swap described and non-described source media, depending on which is playing
  // this function is only called in two circumstances: 
  // 1. Swapping to described version when initializing player (based on user prefs & availability)
  // 2. User is toggling description 
  if (this.initializing || this.openDescOn === false) {
    for (var i=0; i < this.$sources.length; i++) { 
      // for all <source> elements, replace src with data-desc-src (if one exists)
      // then store original source in a new data-orig-src attribute 
      var origSrc = this.$sources[i].getAttribute('src');
      var descSrc = this.$sources[i].getAttribute('data-desc-src'); 
      var srcType = this.$sources[i].getAttribute('type');
      if (descSrc) {
        this.$sources[i].setAttribute('src',descSrc);
        this.$sources[i].setAttribute('data-orig-src',origSrc);
      }       
      if (srcType === 'video/mp4') { 
        var jwSourceIndex = i;
      }       
    }
    this.openDescOn = true;
    if (this.initializing) { // user hasn't pressed play yet 
      this.swappingSrc = false; 
      this.$status.text('Using described version'); 
    }
    else { 
      this.swappingSrc = true; 
      this.$status.text('Loading described version'); 
    }
  }   
  else { 
    // the described version is currently playing
    // swap back to the original 
    for (var i=0; i < this.$sources.length; i++) { 
      // for all <source> elements, replace src with data-orig-src
      var origSrc = this.$sources[i].getAttribute('data-orig-src');
      var srcType = this.$sources[i].getAttribute('type');        
      if (origSrc) {
        this.$sources[i].setAttribute('src',origSrc);
      }       
      if (srcType === 'video/mp4') { 
        var jwSourceIndex = i;
      }
    }
    this.openDescOn = false;
    // No need to check for this.initializing 
    // This function is only called during initialization 
    // if swapping from non-described to described
    this.swappingSrc = true; 
    this.$status.text('Loading non-described version'); 
  }
  // now reload the player 
  if (this.player === 'html5') {
    this.media.load();
  }
  else { 
    var newSource = this.$sources[jwSourceIndex].getAttribute('src');
    this.jwPlayer.load({file: newSource}); 
  }
}
AblePlayer.prototype.swapSource = function(sourceIndex) { 
  // replace default media source elements with those from playlist   
  this.$media.find('source').remove();
  var $newItem = this.$playlist.eq(sourceIndex);
  var itemTitle = $newItem.html();  
  if ($newItem.attr('lang')) { 
    var itemLang = $newItem.attr('lang');
  }
  var sources = [];
  var s = 0; // index 
  if (this.mediaType === 'audio') { 
    if ($newItem.attr('data-mp3')) {
      var jwSource = $newItem.attr('data-mp3'); // JW Player can play this 
      sources[s] =  new Array('audio/mpeg',jwSource); 
      s++;
    }
    if ($newItem.attr('data-webm')) {
      sources[s] = new Array('audio/webm',$newItem.attr('data-webm'));
      s++; 
    }
    if ($newItem.attr('data-webma')) {
      sources[s] = new Array('audio/webm',$newItem.attr('data-webma')); 
      s++; 
    }
    if ($newItem.attr('data-ogg')) {
      sources[s] = new Array('audio/ogg',$newItem.attr('data-ogg')); 
      s++; 
    }
    if ($newItem.attr('data-oga')) {
      sources[s] = new Array('audio/ogg',$newItem.attr('data-oga')); 
      s++; 
    }
    if ($newItem.attr('data-wav')) {
      sources[s] = new Array('audio/wav',$newItem.attr('data-wav')); 
      s++; 
    }
  }
  else if (this.mediaType === 'video') { 
    if ($newItem.attr('data-mp4')) {
      var jwSource = $newItem.attr('data-mp4'); // JW Player can play this 
      sources[s] =  new Array('video/mp4',jwSource); 
      s++; 
    }
    if ($newItem.attr('data-webm')) {
      sources[s] = new Array('video/webm',$newItem.attr('data-webm')); 
      s++; 
    }
    if ($newItem.attr('data-webmv')) {
      sources[s] = new Array('video/webm',$newItem.attr('data-webmv')); 
      s++; 
    }
    if ($newItem.attr('data-ogg')) {
      sources[s] = new Array('video/ogg',$newItem.attr('data-ogg')); 
      s++; 
    }   
    if ($newItem.attr('data-ogv')) {
      sources[s] = new Array('video/ogg',$newItem.attr('data-ogv')); 
      s++; 
    }   
  }     
  for (var i=0; i<sources.length; i++) { 
    var $newSource = $('<source>',{ 
      type: sources[i][0],
      src: sources[i][1] 
    });         
    this.$media.append($newSource);
  }

  // update playlist to indicate which item is playing 
  //$('.ump-playlist li').removeClass('ump-current');
  this.$playlist.removeClass('ump-current');
  $newItem.addClass('ump-current'); 
    
  // update Now Playing div 
  if (this.showNowPlaying === true) {
    var nowPlayingSpan = $('<span>');
    if (typeof itemLang !== 'undefined') { 
      nowPlayingSpan.attr('lang',itemLang); 
    }
    nowPlayingSpan.html('<span>Selected track:</span>' + itemTitle); 
    this.$nowPlayingDiv.html(nowPlayingSpan);
  }
      
  // reload audio after sources have been updated
  // if this.swappingSrc is true, media will autoplay when ready
  if (this.initializing) { // this is the first track - user hasn't pressed play yet 
    this.swappingSrc = false; 
  }
  else { 
    this.swappingSrc = true; 
    this.$status.text('Loading next track');  
    if (this.player === 'html5') {
      this.media.load();
    }   
    else { 
      this.jwPlayer.load({file: jwSource}); 
    }
  }
}
AblePlayer.prototype.toSeconds = function(t) {
  var s = 0.0
  if (t) {
    var p = t.split(':');
    for (var i=0; i < p.length; i++) {
      s = s * 60 + parseFloat(p[i].replace(',', '.'));
    }
  }
  return s;
}
AblePlayer.prototype.strip = function(s) { 
  if (s) { 
    return s.replace(/^\s+|\s+$/g,"");
  }
}
AblePlayer.prototype.playAtTime = function(seconds) { 
  //seeking = true;
  //seekVideo(seconds);
}
AblePlayer.prototype.highlightTranscript = function (currentTime) { 
  //show highlight in transcript marking current caption
  $('.ump-transcript span').each(function() { 
    var thisSpan = $(this); // we need this later 
    var start = $(this).attr('data-start');
    var end = $(this).attr('data-end');
    if (currentTime >= start && currentTime <= end) { 
      if (this.currentHighlight != $(this).index()) {           
        // this is a new highlight. 
        // move all previous highlights before adding one to current span
        $('.ump-highlight').removeClass('ump-highlight');
        $(this).addClass('ump-highlight');
        // scroll this item to the top of the transcript div
        // NOT WORKING GRACEFULLY AS IMPLEMENTED - NEEDS WORK
        // $('.ump-transcript').scrollTop(thisSpan.position().top);         
      }
      return false;
    }
  });
}
AblePlayer.prototype.usingModifierKeys = function(e) { 
  // return true if user is holding down required modifier keys 
  if ((this.prefAltKey === 1) && !e.altKey) { 
    return false;
  } 
  if ((this.prefCtrlKey === 1) && !e.ctrlKey) { 
    return false;
  }
  return true; 
}
AblePlayer.prototype.debugDescription = function(e) { 
  // description is a bit confusing due to the number of variables involved
  // this function can be called to assist in troubleshooting
  // it writes the current value of all related variables to the console
  console.log('hasOpenDesc: ' + this.hasOpenDesc);
  console.log('hasClosedDesc: ' + this.hasOpenDesc);
  console.log('prefDesc: ' + this.prefDesc);
  console.log('prefClosedDesc: ' + this.prefClosedDesc);
  console.log('prefVisibleDesc: ' + this.prefVisibleDesc);
  console.log('closedDescOn: ' + this.closedDescOn);
  console.log('openDescOn: ' + this.openDescOn);
  console.log('useDescType: ' + this.useDescType);  
}