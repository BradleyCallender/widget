(function($, window, document, undefined) {
    var nodeTypes = {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3
    };

    var plugin = {
        name: 'textmanipulator'
    };

    function textmanipulator(element, options) {
        this.context = element;
        this.$context = $(element);
        this.options = $.extend({}, $[plugin.name].defaults, options);

        this.init();
    }

    textmanipulator.prototype = {
        init: function() {
            this.$context.addClass(this.options.contextClass);
            this.bindEvents();
        },

        destroy: function() {
            this.unbindEvents();
            this.$context.removeClass(this.options.contextClass);
            this.$context.removeData(plugin.name);
        },

        bindEvents: function() {
            this.$context.bind('mouseup', {self: this}, this.highlightHandler);
        },

        unbindEvents: function() {
            this.$context.unbind('mouseup', this.highlightHandler);
        },

        highlightHandler: function(event) {
            var self = event.data.self;
            self.doHighlight();
        },


        doHighlight: function() {
            var range = this.getCurrentRange();
            if (!range || range.collapsed) return;
            var rangeText = range.toString();

            if (this.options.onBeforeHighlight(range) == true) {
                var $wrapper = $.textmanipulator.createWrapper(this.options);

                var createdHighlights = this.highlightRange(range, $wrapper);
                var normalizedHighlights = this.normalizeHighlights(createdHighlights);

                this.options.onAfterHighlight(normalizedHighlights, rangeText);
            }

            this.removeAllRanges();
        },

     
        getCurrentRange: function() {
            var selection = this.getCurrentSelection();

            var range;
            if (selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
            }
            return range;
        },

        removeAllRanges: function() {
            var selection = this.getCurrentSelection();
            selection.removeAllRanges();
        },

 
        getCurrentSelection: function() {
            var currentWindow = this.getCurrentWindow();
            var selection;

            if (currentWindow.getSelection) {
                selection = currentWindow.getSelection();
            } else if ($('iframe').length) {
                $('iframe', top.document).each(function() {
                    if (this.contentWindow === currentWindow) {
                        selection = rangy.getIframeSelection(this);
                        return false;
                    }
                });
            } else {
                selection = rangy.getSelection();
            }

            return selection;
        },

  
        getCurrentWindow: function() {
            var currentDoc = this.getCurrentDocument();
            if (currentDoc.defaultView) {
                return currentDoc.defaultView; 
            } else {
                return currentDoc.parentWindow; 
            }
        },


        getCurrentDocument: function() {
           
            return this.context.ownerDocument ? this.context.ownerDocument : this.context;
        },


        highlightRange: function(range, $wrapper) {
            if (range.collapsed) return;

            
            var ignoreTags = ['SCRIPT', 'STYLE', 'SELECT', 'BUTTON', 'OBJECT', 'APPLET'];
            var startContainer = range.startContainer;
            var endContainer = range.endContainer;
            var ancestor = range.commonAncestorContainer;
            var goDeeper = true;

            if (range.endOffset == 0) {
                while (!endContainer.previousSibling && endContainer.parentNode != ancestor) {
                    endContainer = endContainer.parentNode;
                }
                endContainer = endContainer.previousSibling;
            } else if (endContainer.nodeType == nodeTypes.TEXT_NODE) {
                if (range.endOffset < endContainer.nodeValue.length) {
                    endContainer.splitText(range.endOffset);
                }
            } else if (range.endOffset > 0) {
                endContainer = endContainer.childNodes.item(range.endOffset - 1);
            }

            if (startContainer.nodeType == nodeTypes.TEXT_NODE) {
                if (range.startOffset == startContainer.nodeValue.length) {
                    goDeeper = false;
                } else if (range.startOffset > 0) {
                    startContainer = startContainer.splitText(range.startOffset);
                    if (endContainer == startContainer.previousSibling) endContainer = startContainer;
                }
            } else if (range.startOffset < startContainer.childNodes.length) {
                startContainer = startContainer.childNodes.item(range.startOffset);
            } else {
                startContainer = startContainer.nextSibling;
            }

            var done = false;
            var node = startContainer;
            var highlights = [];

            do {
                if (goDeeper && node.nodeType == nodeTypes.TEXT_NODE) {
                    if (/\S/.test(node.nodeValue)) {
                        var wrapper = $wrapper.clone(true).get(0);
                        var nodeParent = node.parentNode;

                        
                        if ($.contains(this.context, nodeParent) || nodeParent === this.context) {
                            var highlight = $(node).wrap(wrapper).parent().get(0);
                            highlights.push(highlight);
                        }
                    }

                    goDeeper = false;
                }
                if (node == endContainer && (!endContainer.hasChildNodes() || !goDeeper)) {
                    done = true;
                }

                if ($.inArray(node.tagName, ignoreTags) != -1) {
                    goDeeper = false;
                }
                if (goDeeper && node.hasChildNodes()) {
                    node = node.firstChild;
                } else if (node.nextSibling != null) {
                    node = node.nextSibling;
                    goDeeper = true;
                } else {
                    node = node.parentNode;
                    goDeeper = false;
                }
            } while (!done);

            return highlights;
        },

      
        normalizeHighlights: function(highlights) {
            this.flattenNestedHighlights(highlights);
            this.mergeSiblingHighlights(highlights);

            
            var normalizedHighlights = $.map(highlights, function(hl) {
                if (typeof hl.parentElement != 'undefined') { // IE
                    return hl.parentElement != null ? hl : null;
                } else {
                    return hl.parentNode != null ? hl : null;
                }
            });

            return normalizedHighlights;
        },

        flattenNestedHighlights: function(highlights) {
            var self = this;

            $.each(highlights, function(i) {
                var $highlight = $(this);
                var $parent = $highlight.parent();
                var $parentPrev = $parent.prev();
                var $parentNext = $parent.next();

                if (self.isHighlight($parent)) {
                    if ($parent.css('background-color') != $highlight.css('background-color')) {
                        if (self.isHighlight($parentPrev) && !$highlight.get(0).previousSibling
                            && $parentPrev.css('background-color') != $parent.css('background-color')
                            && $parentPrev.css('background-color') == $highlight.css('background-color')) {

                            $highlight.insertAfter($parentPrev);
                        }

                        if (self.isHighlight($parentNext) && !$highlight.get(0).nextSibling
                            && $parentNext.css('background-color') != $parent.css('background-color')
                            && $parentNext.css('background-color') == $highlight.css('background-color')) {

                            $highlight.insertBefore($parentNext);
                        }

                        if ($parent.is(':empty')) {
                            $parent.remove();
                        }
                    } else {
                        var newNode = document.createTextNode($parent.text());

                        $parent.empty();
                        $parent.append(newNode);
                        $(highlights[i]).remove();
                    }
                }
            });
        },

        mergeSiblingHighlights: function(highlights) {
            var self = this;

            function shouldMerge(current, node) {
                return node && node.nodeType == nodeTypes.ELEMENT_NODE
                    && $(current).css('background-color') == $(node).css('background-color')
                    && $(node).hasClass(self.options.highlightedClass)
                    ? true : false;
            }

            $.each(highlights, function() {
                var highlight = this;

                var prev = highlight.previousSibling;
                var next = highlight.nextSibling;

                if (shouldMerge(highlight, prev)) {
                    var mergedTxt = $(prev).text() + $(highlight).text();
                    $(highlight).text(mergedTxt);
                    $(prev).remove();
                }
                if (shouldMerge(highlight, next)) {
                    var mergedTxt = $(highlight).text() + $(next).text();
                    $(highlight).text(mergedTxt);
                    $(next).remove();
                }
            });
        },

        
        setColor: function(color) {
            this.options.color = color;
        },

       
        getColor: function() {
            return this.options.color;
        },

        
        clearhighlightedarea: function(element) {
            var container = (element !== undefined ? element : this.context);

            var unwrapHighlight = function(highlight) {
                return $(highlight).contents().unwrap().get(0);
            };

            var mergeSiblingTextNodes = function(textNode) {
                var prev = textNode.previousSibling;
                var next = textNode.nextSibling;

                if (prev && prev.nodeType == nodeTypes.TEXT_NODE) {
                    textNode.nodeValue = prev.nodeValue + textNode.nodeValue;
                    prev.parentNode.removeChild(prev);
                }
                if (next && next.nodeType == nodeTypes.TEXT_NODE) {
                    textNode.nodeValue = textNode.nodeValue + next.nodeValue;
                    next.parentNode.removeChild(next);
                }
            };

            var self = this;
            var $highlights = this.getAllHighlights(container, true);
            $highlights.each(function() {
                if (self.options.onRemoveHighlight(this) == true) {
                    var textNode = unwrapHighlight(this);
                    mergeSiblingTextNodes(textNode);
                }
            });
        },

        
        getAllHighlights: function(container, andSelf) {
            var classSelectorStr = '.' + this.options.highlightedClass;
            var $highlights = $(container).find(classSelectorStr);
            if (andSelf == true && $(container).hasClass(this.options.highlightedClass)) {
                $highlights = $highlights.add(container);
            }
            return $highlights;
        },

        
        isHighlight: function($el) {
            return $el.hasClass(this.options.highlightedClass);
        },

        
        serializeHighlights: function() {
            var $highlights = this.getAllHighlights(this.context);
            var refEl = this.context;
            var hlDescriptors = [];
            var self = this;

            var getElementPath = function (el, refElement) {
                var path = [];

                do {
                    var elIndex = $.inArray(el, el.parentNode.childNodes);
                    path.unshift(elIndex);
                    el = el.parentNode;
                } while (el !== refElement);

                return path;
            };

            $highlights.each(function(i, highlight) {
                var offset = 0; 
                var length = highlight.firstChild.length;
                var hlPath = getElementPath(highlight, refEl);
                var wrapper = $(highlight).clone().empty().get(0).outerHTML;

                if (highlight.previousSibling && highlight.previousSibling.nodeType === nodeTypes.TEXT_NODE) {
                    offset = highlight.previousSibling.length;
                }

                hlDescriptors.push([
                    wrapper,
                    $(highlight).text(),
                    hlPath.join(':'),
                    offset,
                    length
                ]);
            });

            return JSON.stringify(hlDescriptors);
        },

        
        deserializeHighlights: function(json) {
            try {
                var hlDescriptors = JSON.parse(json);
            } catch (e) {
                throw "Can't parse serialized highlights: " + e;
            }
            var highlights = [];
            var self = this;

            var deserializationFn = function (hlDescriptor) {
                var wrapper = hlDescriptor[0];
                var hlText = hlDescriptor[1];
                var hlPath = hlDescriptor[2].split(':');
                var elOffset = hlDescriptor[3];
                var hlLength = hlDescriptor[4];
                var elIndex = hlPath.pop();
                var idx = null;
                var node = self.context;

                while ((idx = hlPath.shift()) !== undefined) {
                    node = node.childNodes[idx];
                }

                if (node.childNodes[elIndex-1] && node.childNodes[elIndex-1].nodeType === nodeTypes.TEXT_NODE) {
                    elIndex -= 1;
                }

                var textNode = node.childNodes[elIndex];
                var hlNode = textNode.splitText(elOffset);
                hlNode.splitText(hlLength);

                if (hlNode.nextSibling && hlNode.nextSibling.nodeValue == '') {
                    hlNode.parentNode.removeChild(hlNode.nextSibling);
                }

                if (hlNode.previousSibling && hlNode.previousSibling.nodeValue == '') {
                    hlNode.parentNode.removeChild(hlNode.previousSibling);
                }

                var highlight = $(hlNode).wrap(wrapper).parent().get(0);
                highlights.push(highlight);
            };

            $.each(hlDescriptors, function(i, hlDescriptor) {
                try {
                    deserializationFn(hlDescriptor);
                } catch (e) {
                    console && console.warn
                        && console.warn("Can't deserialize " + i + "-th descriptor. Cause: " + e);
                    return true;
                }
            });

            return highlights;
        }

    };

    
    $.fn.retrivehighlighter = function() {
        return this.data(plugin.name);
    };

    $.fn[plugin.name] = function(options) {
        return this.each(function() {
            if (!$.data(this, plugin.name)) {
                $.data(this, plugin.name, new textmanipulator(this, options));
            }
        });
    };

    $.textmanipulator = {
        
        createWrapper: function(options) {
            return $('<span></span>')
                .css('backgroundColor', options.color)
                .addClass(options.highlightedClass);
        },
        defaults: {
            color: 'black',
            highlightedClass: 'highlighted',
            contextClass: 'highlighter-context',
            onRemoveHighlight: function() { return true; },
            onBeforeHighlight: function() { return true; },
            onAfterHighlight: function() { }
        }
    };

})(jQuery, window, document);