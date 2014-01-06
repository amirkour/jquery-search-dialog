/*
 * jquery-search-dialog.js
 *
 * A jquery plugin that creates a popup window on any dom element (though
 * it's intended usage is on textboxes) for searching and paging through
 * server data.
 *
 * Usage:
 * var $input=$("input.searchBox");
 * $input.searchDialog({ ... options ... });
 *
 * Now when $input gains focus, the search popup will appear.  Typing
 * search terms in $input and hitting 'enter' will send a query to
 * the server and display the results for user selection.
 *
 * Additional notes and documentation:
 * https://github.com/amirkour/jquery-search-dialog
 *
 * Depends on jquery, and currently only tested/verified on jquery 1.9+.
 */
(function ($, document, undefined) {
    var $body = $("body");

    var strPluginEventNamespace = ".searchDialogNS";
    var strPluginDataNamespace = "searchDialogData";
    var strSelectionButtonDataNamespace = "searchDialogSelectionButtonData";
    var cssClasses = {
        dialogClass: "searchDialog_dialog",
        exitButtonClass: "searchDialog_exitButton",
        ajaxErrorDisplayClass: "searchDialog_ajaxErrorDisplay",
        selectionButtonDivClass: "searchDialog_selectionButtonDiv",
        selectionButtonClass: "searchDialog_selectionButton",
        loadingDivClass: "searchDialog_loadingDiv",
        pagingDivClass: "searchDialog_pagingDiv",
        nextPageButtonClass: "searchDialog_nextPageButton",
        previousPageButtonClass: "searchDialog_previousPageButton"
    };
    var hashOfTokensToOmitDuringSearch = {
        and: 1,
        the: 1
    };

    var $exitButtonBase = $(document.createElement("button"))
						.html("X")//TODO - customizable?
						.addClass(cssClasses.exitButtonClass)
						.css("float", "right"); //todo - customizable?

    var $dialogBase = $(document.createElement("div"))
					.addClass(cssClasses.dialogClass)
					.css("position", "absolute")
					.css("z-index", 99999)
					.css("background-color", "white")
			   		.css("border", "thin solid black")
					.hide();

    var $errorDivBase = $(document.createElement("div"))
					  .addClass(cssClasses.ajaxErrorDisplayClass)
					  .hide();

    var $selectionButtonDivBase = $(document.createElement("div"))
								.addClass(cssClasses.selectionButtonDivClass);

    var $selectionButtonBase = $(document.createElement("button"))
							 .addClass(cssClasses.selectionButtonClass)
							 .attr("type", "button");

    var $loadingDivBase = $(document.createElement("div"))
						 .addClass(cssClasses.loadingDivClass)
						 .html("Loading ...") // todo - this probably shouldn't be hardcoded text  :\
						 .hide();

    var $pagingDivBase = $(document.createElement("div"))
					   .addClass(cssClasses.pagingDivClass);

    var $nextPageButtonBase = $(document.createElement("button"))
							.attr("type", "button")
							.attr('disabled', 'disabled')
							.html(" > ")
							.addClass(cssClasses.nextPageButtonClass);

    var $previousPageButtonBase = $(document.createElement("button"))
								.attr("type", "button")
								.attr('disabled', 'disabled')
								.html(" < ")
								.addClass(cssClasses.previousPageButtonClass);

    var PluginKlass = function (options) {
        if (!options) throw "Cannot init plugin without init options";
        if (!options.input) throw "Cannot init plugin without 'input' init option";
        if (!options.url) throw "Cannot init plugin without 'url' init option"
        var self = this;

        this.url = options.url;
        this.$input = (options.input instanceof $) ? options.input : $(options.input);
        this.resultButtons = []; // list of buttons to select from while searching
        this.iPage = 0;
        this.iPageSize = 10;

        if (options.fnLabelMapper && typeof options.fnLabelMapper === 'function') {
            this.fnLabelMapper = options.fnLabelMapper;
        } else {
            this.fnLabelMapper = function (obj) { return obj.toString(); }
        }

        this.fnSelectionCB = options.fnSelectionCB || fnEmpty;

        // setup exit button position/behavior
        this.$exitButton = $exitButtonBase.clone();
        this.$exitButton.on("click" + strPluginEventNamespace, function (e) {
            self.fnHide();
        });

        // setup button div position/behavior
        this.$selectionButtonDiv = $selectionButtonDivBase.clone();

        // setup error div position/behavior
        this.$errorDiv = $errorDivBase.clone();

        // setup loading div position/behavior
        this.$loadingDiv = $loadingDivBase.clone();

        // setup paging bar
        this.$nextPageButton = $nextPageButtonBase.clone();
        this.$nextPageButton.on("click" + strPluginEventNamespace, function (e) {
            self.fnNextPageClick();
        });

        this.$previousPageButton = $previousPageButtonBase.clone();
        this.$previousPageButton.on("click" + strPluginEventNamespace, function (e) {
            self.fnPreviousPageClick();
        });

        this.$pagingDiv = $pagingDivBase.clone();
        this.$pagingDiv.append(this.$previousPageButton)
					   .append(this.$nextPageButton);

        // setup dialog window position and behavior
        var pInputOffset = this.$input.offset();
        this.$dialog = $dialogBase.clone();
        this.$dialog.append(this.$exitButton)
					.append(this.$pagingDiv)
					.append(this.$errorDiv)
					.append(this.$loadingDiv)
					.append(this.$selectionButtonDiv)
				    .css("top", pInputOffset.top + this.$input.outerHeight() + "px")
				    .css("left", pInputOffset.left + "px")
				    .css("min-height", "200px")//todo - customizable?
				    .css("min-width", "200px")//todo - customizable?
				    .appendTo($body);

        this.$input.on("focus" + strPluginEventNamespace, function (e) {
            self.fnShow();
        }).on("keyup" + strPluginEventNamespace, function (e) {
            if (e.which === 13) {
                self.iPage = 0; // start the search at page 0
                self.fnSearch();
            }
        });
    }
    $.extend(PluginKlass.prototype, {
        fnDestroy: function () {
            this.fnCleanupPreviousResults();
            this.$nextPageButton.off(strPluginEventNamespace);
            this.$previousPageButton.off(strPluginEventNamespace);
            this.$input.off(strPluginEventNamespace);
            this.$exitButton.off(strPluginEventNamespace);

            this.fnSelectionCB = null;
            this.fnLabelMapper = null;

            this.$dialog.remove();
            this.$dialog = null;
            this.$input = null;
        },
        fnNextPageClick: function () {
            this.iPage++;
            this.fnSearch();
        },
        fnPreviousPageClick: function () {
            if (this.iPage <= 0) return;

            this.iPage--;
            this.fnSearch();
        },
        fnSearch: function () {
            var strInput = this.$input.val();
            if (!strInput) return;

            var searchTokens = $.grep(strInput.split(/\s+/), function (token) {
                return !hashOfTokensToOmitDuringSearch[token];
            });

            if (!searchTokens || searchTokens.length <= 0) return;

            this.fnLoading(true);
            this.fnClearErrors();
            this.fnDisableButtons();
            var url = encodeURI(this.url + "?f=" + searchTokens.join("&f=") + "&page=" + this.iPage + "&pagesize=" + this.iPageSize);
            $.ajax({
                url: url,
                context: this,
                dataType: 'json',
                type: 'get',
                error: this.fnAjaxErrorHandler,
                success: this.fnAjaxSuccessHandler
            }).always(function () {
                this.fnLoading(false);
            });
        },
        fnDisableButtons: function () {
            this.$nextPageButton.attr('disabled', 'disabled');
            this.$previousPageButton.attr('disabled', 'disabled');
        },
        fnAjaxSuccessHandler: function (pData, strTextStatus, jqXHR) {
            if (!pData) {
                this.fnShowError("Server responded successfully, but no result data present!?");
                return;
            }
            if (!(pData instanceof Array)) {
                this.fnShowError("Expected server response to be a list");
                return;
            }

            this.fnCleanupPreviousResults();
            if (pData.length >= this.iPageSize) {
                this.$nextPageButton.attr('disabled', null);
            }
            if (this.iPage > 0) {
                this.$previousPageButton.attr('disabled', null);
            }

            if (pData.length <= 0) {
                this.fnShowError("No results");
                return;
            }

            var i = 0, iLen = pData.length, self = this;
            for (; i < iLen; i++) {
                var next = pData[i];
                var label = this.fnLabelMapper.call(next, next) || next.toString();
                var $button = $selectionButtonBase.clone();
                $button.html(label)
					   .data(strSelectionButtonDataNamespace, { data: next, oPlugin: self })
					   .on("click" + strPluginEventNamespace, self.fnSelectionButtonClick);
                var div = document.createElement("div");
                $button.appendTo(div);
                this.resultButtons.push($button);
                this.$selectionButtonDiv.append(div);
                //todo - this op might go faster if you pluck the button div out of the dom before futzing with it
            }
        },
        fnAjaxErrorHandler: function (jqXHR, strTextStatus, strErrorThrown) {
            strError = null;
            if (jqXHR.responseText) {
                try {
                    var pError = JSON.parse(jqXHR.responseText);
                    strError = pError.error || pError.Error;
                } catch (ex) { }
            }

            this.fnShowError(strError || "An unknown server error occurred");
        },
        fnSelectionButtonClick: function (e) {
            var $button = $(e.target);
            var data = $button.data(strSelectionButtonDataNamespace);
            var oPlugin = data.oPlugin;
            var $input = oPlugin.$input;
            data = data.data;
            oPlugin.fnSelectionCB.call($input, data);
            oPlugin.fnHide();
        },
        fnLoading: function (bLoading) {
            if (bLoading === true) {
                this.$loadingDiv.show();
            } else {
                this.$loadingDiv.hide();
            }
        },
        fnCleanupPreviousResults: function () {
            this.resultButtons = $.grep(this.resultButtons, function ($button) {
                $button.off(strPluginEventNamespace);
                $button.data(strSelectionButtonDataNamespace, null);
                $button.remove();
                return false;
            });
            this.$selectionButtonDiv.empty();
        },
        fnClearErrors: function () {
            this.$errorDiv.empty().hide();
        },
        fnShowError: function (strError) {
            if (!strError) return;
            this.$errorDiv.html(strError).show();
        },
        fnShow: function () {
            this.$dialog.show();
        },
        fnHide: function () {
            this.fnClearErrors();
            this.$dialog.hide();
        }
    });

    function fnPluginDestroy() {
        if (!this) return;
        if (!(this instanceof $)) return;
        return this.each(function () {
            var $this = $(this);
            var oPlugin = $this.data(strPluginDataNamespace);
            if (oPlugin) {
                oPlugin.fnDestroy();
                $this.data(strPluginDataNamespace, null);
            }
        });
    }

    function fnPluginInit(options) {
        if (!this) return;
        if (!(this instanceof $)) return;

        return this.each(function (i, elem) {
            var $this = $(elem);

            // if the plugin already exists on this object, don't init again
            var oPlugin = $this.data(strPluginDataNamespace);
            if (!oPlugin) {
                options = $.extend({
                    input: $this
                }, options);

                oPlugin = new PluginKlass(options);
                $this.data(strPluginDataNamespace, oPlugin);
            }
        });
    }

    function fnEmpty() { }

    function fnGetPluginFunctionFor(strPluginCommand) {
        if (!strPluginCommand) return fnEmpty;
        if (typeof strPluginCommand !== 'string') return fnEmpty;

        var functionToReturn;
        switch (strPluginCommand) {
            case "destroy":
                functionToReturn = fnPluginDestroy;
                break;
            default:
                functionToReturn = fnEmpty;
                break;
        }

        return functionToReturn;
    }

    $.fn.searchDialog = function (options) {
        if (this.length <= 0) return this;

        var functionToCall,
			argsToPass;

        if (!options || typeof options === 'object') {
            functionToCall = fnPluginInit;
            defaultoptions = {}; //todo - do i need this? might be able to use defaults in fnPluginInit..?
            argsToPass = [$.extend(defaultoptions, options)];
        } else if (typeof options === 'string') {
            functionToCall = fnGetPluginFunctionFor(options);
            argsToPass = Array.prototype.slice.call(1);
        }

        if (!functionToCall) return this;
        return functionToCall.apply(this, argsToPass);
    }
})(jQuery, document);