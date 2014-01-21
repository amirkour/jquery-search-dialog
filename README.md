jquery-search-dialog
====================

A jquery plugin that creates a popup window on any dom element (though it's intended usage is on textboxes) for searching and paging through server data.

Quick Summary
-------------
```javascript
var $input=$("input.searchBox");
$input.searchDialog({ ... options ... });
```

Now when $input gains focus, the search popup will appear. Typing search terms in $input and hitting 'enter' will send a query to the server and display the results for user selection.

Usage
-----
```javascript
$("input.searchBox").searchDialog({

  // required - plugin will not init w/o this.
  // the url to query for server data
  url: "/service/json/coolData", 
  
  // optional - lets you map data returned from
  // the server to a pretty label.
  // if omitted, the plugin will render toString.
  fnLabelMapper: function(serverData){
    return serverData.label; // or w/e
  },
  
  // optional - when the user makes a selection,
  // the plugin will invoke this callback with
  // the user's selection.  "this" is set to
  // your jquery-ified textbox.
  fnSelectionCB: function(selectedServerData){
    this.val(selectedServerData.label);
  },
  
  // optional - if present, will perform a
  // search immediately upon the first 'show'
  // of the plugin.
  strInitialSearch: "inital search string"
  
});
```

Example
-------
Assume you initialize a textbox with the code shown in the 'usage' section above.  Searching for "foo bar baz" would result in the following http-get request:

http://your.domain.com/service/json/coolData?f=foo&f=bar&f=baz&page=0&pagesize=10

Note: pagesize is currently hardcoded to 10.  If your server responds with data looking like this:

[{label: "option 1", name: "foo"}, {label: "option 2", name: "bar"}, ... ]

You can use fnLabelMapper to render the "label" key for the user to chose from - IE, they'd get to select one of these (again, with respect to 'usage' example above):

<ul><li>option 1</li><li>option 2</li>...</ul>

When the user makes a selection, the entire associated object is passed to fnSelectionCB - IE, if the user selected "option 1", fnSelectionCB would receive {label: "option 1", name: "foo"}.

API
---
```javascript

// return previously initialized input to it's original state.
// unbinds all plugin-related events and destroys all plugin DOM elements.
$initializedInput.searchDialog("destroy");
```
