// Partially copied from
// https://github.com/SantiagoGdaR/js-two-way-binding/blob/master/app.js

(function() {
    var elements = document.querySelectorAll('[snake-pixel]'),
        scope = {};
    elements.forEach(function(element) {






            



        function addScopeProp(prop){

            if(!scope.hasOwnProperty(prop)){

                var value;
                Object.defineProperty(scope, prop, {
                    set: function (newValue) {
                        value = newValue;
                        elements.forEach(function(element){
    
                            if(element.getAttribute('data-tw-bind') === prop){
                                if(element.type && (element.type === 'text' ||
                                    element.type === 'textarea')){
                                    element.value = newValue;
                                }
                                else if(!element.type
                                    element.innerHTML = newValue;
                                }
                            }
                        });
                    },
                    get: function(){
                        return value;
                    },
                    enumerable: true
                })
            }
        }
    });
