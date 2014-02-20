require([
    '$api/models', '$views/list#List', '$api/activity#Feed',
    ], function(models, List, Feed) {

var currentPlaylist;

(function($){
   var schedule = function(callback, table, scope, error){
      var i = 0;
      var tick = function(){
         if(i < table.length){
            try{
               callback.call(scope || window, table[i], i);
               setTimeout(tick, table[i]);
               i++;
            }catch(e){
               error = error || function(){};
               if(error){
                  error(e, table[i], i);
               }
            }
         }
      };
      //if(table && table.length){
      //   setTimeout(tick, table[i]);
      //}
      tick();
   };
   
   var convertMillis = function(ms){
      return {
         minutes: Math.floor(ms/60000),
         seconds: Math.floor(ms/1000)%60,
         millis: ms%1000
      };
   };
   
   var pad = function (n){
      return n > 9 ? n+'':'0'+n;
   };
   
   var TBTimer = function(config, playlist){
      this.playlist = playlist
      this.resolution = config.resolution || 10;
      config.specs = config.specs || {};
      this.specs = {
         rounds: config.specs.rounds || 8,
         rest: config.specs.rest || 10,
         work: config.specs.work || 20
      };
      
      var current = {};

      var player = models.player;

      this.displayEl = $('.timer-display')[0];
      
      this.getValues = function(){
         var rounds = $('.input-rounds').val();
         var rest = $('.input-rest').val();
         var work = $('.input-work').val();
         
         $('.input-rounds').removeClass('state-error-mark');
         $('.input-rest').removeClass('state-error-mark');
         $('.input-work').removeClass('state-error-mark');
         
         var correct = true;
         try{
            rounds = parseInt(rounds);
         }catch(e){
            $('.input-rounds').addClass('state-error-mark');
            correct =  false;
         }
         if(isNaN(rounds) || rounds <= 0){
            $('.input-rounds').addClass('state-error-mark');
            correct =  false;
         }
         
         try{
            rest = parseFloat(rest);
         }catch(e){
            $('.input-rest').addClass('state-error-mark');
            correct =  false;
         }
         
         if( isNaN(rest) || rest <= 0){
            $('.input-rest').addClass('state-error-mark');
            correct =  false;
         }  
         
         try{
            work = parseFloat(work);
         }catch(e){
            $('.input-work').addClass('state-error-mark');
            correct =  false;
         }
         
         if( isNaN(work) || work<= 0){
            $('.input-work').addClass('state-error-mark');
            correct =  false;
         }  
         
         if(!correct){
            this.notify('Incorrect!');
            return false;
         }
         
         this.specs = {
            rounds: rounds,
            rest: rest,
            work: work
         };
         return this.specs;
      };
      
      this.start = function(){
         player.playContext(currentPlaylist);

         var s = this.getValues();
         if(s){
            var rs = [];
            var schedules = [];
            for(var i = 0; i < s.rounds; i++){
               rs.push({
                  total: s.work * 1000,
                  round: i+1,
                  type: 'work'
               });
               schedules.push(s.work*1000);
               
               rs.push({
                  total: s.rest * 1000,
                  round: i+1,
                  type: 'rest'
               });
               schedules.push(s.rest*1000);
            }
            schedules.push(500);
            this.rounds = rs;
            console.log('start');
            this.running = true;
            schedule(function(delay, rn){
               this._doRound(rn);
            }, schedules, this);
            
            $('.timer-start').val('Stop');
            return {s:schedules, r:rs};
         }
      };
      this.stop  = function(){
         player.stop();
         this.running = false;
         $('.timer-start').val('Start');
         this.notifyForRound('-', 'rest');
         if(current.timerId){
            clearInterval(current.timerId);
            current.round.end = new Date().getTime();
         }
         this.rounds = [];
         this.updateDisplay(0);
         
      };
      this.notify = function(message){
         $('.global-notification').html(message);
         $('.overlay-container').fadeIn('slow', function(){
            $('.overlay-container').delay(1000).fadeOut('slow');
         });
      };
      this.updateDisplay = function(ms){
         var tm = convertMillis(ms);
         this.displayEl.innerHTML = 
            pad(tm.minutes) + ':' + 
            pad(tm.seconds) + ':' +
            pad(Math.floor(tm.millis/10));
      };
      
      this._doRound = function(rn){
         if(!this.running){
            return;
         }
         // stop current if running ....
         if(current.timerId){
            clearInterval(current.timerId);
            current.round.end = new Date().getTime();
         }
         this.updateDisplay(0);
         var self =this;
         if(this.rounds[rn]){
            var __tick = function(){
               if(!self.running){
                  return;
               }
               var currentTime = new Date().getTime();
               var elapsedTime = currentTime - self.rounds[rn].start;
               var dtm = self.rounds[rn].total - elapsedTime;
               if(dtm > 0){
                  self.updateDisplay(dtm);
               }else{
                  self.updateDisplay(0);
                  if(current.timerId){
                     clearInterval(current.timerId);
                     current.round.end = new Date().getTime();
                  }
               }
            }
            current.round = this.rounds[rn];
            current.round.start = new Date().getTime();
            current.timerId = setInterval(__tick, this.resolution);
            var roundNumber = Math.floor(rn/2) + 1;
            this.notifyForRound(roundNumber, current.round.type);
            if(current.round.type == 'rest'){
               this.notify('Rest!');
               player.setVolume(0.3);
               $('#rtype').css('background-color', '#ad0082');

            }else{
               this.notify('Work!');
               player.setVolume(1.0);
               $('#rtype').css('background-color', '#2ba706');
            }
         }else{
            this.notify('Bravo!');
            this.stop();
            $('#rtype').css('background-color', '#464f47');
         }
      };
      
      this.notifyForRound = function(rn, type){
         $('.round-number').html(rn);
         $('.round-type').html(type=='rest' ? 'REST':'WORK');
      };
      var self = this;
      $('.timer-start').click(function(){
         if(!self.running){
            self.start();
         }else{
            self.stop();
            self.notify('Stopped!');
         }
      });


      
      $(document).keypress(function(e){
         switch(e.which){
            case 32: // space
            case 115: // s
            case 13: // return
            // these are toggle
               if(!self.running){
                  self.start();
               }else{
                  self.stop();
                  self.notify('Stopped!');
               }
               break;
            case 112: // p
               self.stop();
               self.notify('Stopped!');
               break;
            case 114: // r
               self.start();
               break;
         }
      });
      
      
   };

   
   $(document).ready(function(){

      var dropBox = document.querySelector('#drop-box');

      dropBox.addEventListener('dragstart', function(e){
          e.dataTransfer.setData('text/html', this.innerHTML);
          e.dataTransfer.effectAllowed = 'copy';
      }, false);

      dropBox.addEventListener('dragenter', function(e){
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          this.classList.add('over');
      }, false);

      dropBox.addEventListener('dragover', function(e){
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          return false;
      }, false);

      dropBox.addEventListener('dragleave', function(e){
          e.preventDefault();
          this.classList.remove('over');
      }, false);

      dropBox.addEventListener('drop', function(e){
          e.preventDefault();
          var drop = models.Playlist.fromURI(e.dataTransfer.getData('text'));
          var options = {
            style: 'rounded',
            height: 'fixed',
            throbber: 'hide-content',
          };
          this.classList.remove('over');
          var list = List.forPlaylist(drop, options);

         drop.load('name').done(function(playlist) {
            $( '.playlist-title' ).replaceWith( '<h2>' + playlist.name.decodeForText() + '</h2>' );
         });

         drop.load('tracks').done(function(playlist) {
            currentPlaylist = playlist.tracks;
         }); 

          this.appendChild(list.node);
          list.init();
      }, false);
      
      
      tm = new TBTimer({}, currentPlaylist);

   }); //document ready
   
})(jQuery);

}); // require