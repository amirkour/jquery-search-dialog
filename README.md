jquery-search-dialog
====================

turn textboxes into pageable, keyword searchable controls that allows you to quickly query and page through server data.

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
  }
  
});
```

API
---
```javascript

// return previously initialized input to it's original state.
// unbinds all plugin-related events and destroys all plugin DOM elements.
$initializedInput.searchDialog("destroy");
```
