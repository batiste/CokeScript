
window.onload = function () {
  var STORAGE_KEY, items, all_checked, editItem, virtual_dom, real_dom, new_todo;
  STORAGE_KEY = 'cokestore';
  
  function itemClass(item) {
    var cls;
    cls = [];
    if(item.complete) {
      cls.push('completed');
    }
    if(editItem === item) {
      cls.push('editing');
    }
    return cls.join(' ');
  }
  
  function todoMVC(items) {
    var __c1 = [];
    var __c2, __c3, __c4, __tmp, __c5, i, __index1, __keys1, item;
    __c2 = [];
      __c3 = [];
        __c4 = [];
          __tmp = "todos"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
        __c3.push(cokescript.h("h1", {}, __c4));
        
        __c3.push(cokescript.h("input", {"id": "new-todo", "placeholder": "What needs to be done?", "autofocus": true}, []));
        __c4 = [];
          if(all_checked) {
            
            __c4.push(cokescript.h("input", {"id": "toggle-all", "type": "checkbox", "checked": "checked"}, []));
          } else {
            
            __c4.push(cokescript.h("input", {"id": "toggle-all", "type": "checkbox"}, []));
          }
          __c5 = [];
            __tmp = "Mark all as complete"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
          __c4.push(cokescript.h("label", {"for": "toggle-all"}, __c5));
          i = 0;
          __c5 = [];
            __keys1 = Object.keys(items);
            for(__index1 = 0; __index1 < __keys1.length; __index1++) {
              item = items[__keys1[__index1]];
              __tmp = listItem(item, i); __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
              i++;
            }
          __c4.push(cokescript.h("ul", {"id": "todo-list"}, __c5));
        __c3.push(cokescript.h("section", {"id": "main"}, __c4));
      __c2.push(cokescript.h("header", {"id": "header"}, __c3));
      __tmp = footer(); __tmp instanceof Array ? (__c2 = __c2.concat(__tmp)) : __c2.push(String(__tmp));
    __c1.push(cokescript.h("section", {"id": "todoapp"}, __c2));
    return __c1;
  }
  
  function footer() {
    var __c1 = [];
    var __c2, __c3, __c4, __tmp, __c5;
    __c2 = [];
      __c3 = [];
        __c4 = [];
          __tmp = "2"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
        __c3.push(cokescript.h("strong", {}, __c4));
        " item left";
      __c2.push(cokescript.h("span", {"id": "todo-count"}, __c3));
      __c3 = [];
        __c4 = [];
          __c5 = [];
            __tmp = "All"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
          __c4.push(cokescript.h("a", {"href": "#/", "class": "selected"}, __c5));
        __c3.push(cokescript.h("li", {}, __c4));
        __c4 = [];
          __c5 = [];
            __tmp = "Active"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
          __c4.push(cokescript.h("a", {"href": "#/active"}, __c5));
        __c3.push(cokescript.h("li", {}, __c4));
        __c4 = [];
          __c5 = [];
            __tmp = "Completed"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
          __c4.push(cokescript.h("a", {"href": "#/completed"}, __c5));
        __c3.push(cokescript.h("li", {}, __c4));
        __c4 = [];
          __tmp = "Clear completed"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
        __c3.push(cokescript.h("button", {"id": "clear-completed"}, __c4));
      __c2.push(cokescript.h("ul", {"id": "filters"}, __c3));
    __c1.push(cokescript.h("footer", {"id": "footer"}, __c2));
    return __c1;
  }
  
  function listItem(item,index) {
    var __c1 = [];
    var __c2, __c3, __c4, __tmp;
    __c2 = [];
      __c3 = [];
        if(item.complete) {
          
          __c3.push(cokescript.h("input", {"class": "toggle", "type": "checkbox", "checked": true, "data-index": "" + index + ""}, []));
        } else {
          
          __c3.push(cokescript.h("input", {"class": "toggle", "type": "checkbox", "data-index": "" + index + ""}, []));
        }
        __c4 = [];
          __tmp = item.value; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
        __c3.push(cokescript.h("label", {"data-index": "" + index + ""}, __c4));
        
        __c3.push(cokescript.h("button", {"class": "destroy", "data-index": "" + index + ""}, []));
      __c2.push(cokescript.h("div", {"class": "view"}, __c3));
      
      __c2.push(cokescript.h("input", {"class": "edit", "value": "" + item.value + "", "data-index": "" + index + ""}, []));
    __c1.push(cokescript.h("li", {"class": itemClass(item)}, __c2));
    return __c1;
  }
  
  items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  all_checked = true;
  items.map(function (el) { return all_checked = !el.complete ? false : true; });
  editItem = false;
  
  virtual_dom = cokescript.h("div", todoMVC(items));
  real_dom = cokescript.create(virtual_dom);
  document.body.appendChild(real_dom);
  
  function get(id) {
    return document.getElementById(id);
  }
  
  function update() {
    var new_virtual_dom, patches;
    new_virtual_dom = cokescript.h("div", todoMVC(items));
    patches = cokescript.diff(virtual_dom, new_virtual_dom);
    cokescript.patch(real_dom, patches);
    virtual_dom = new_virtual_dom;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  
  new_todo = get("new-todo");
  
  new_todo.onkeypress = function (e) {
    var v;
    v = new_todo.value;
    if(e.which === 13 && v) {
      items.push({value: v, completed: false});
      update();
    }
  };
  
  function hasClass(dom,cls) {
    var m;
    if(!dom.className) {
      return false;
    }
    m = new RegExp("\\b" + cls + "\\b");
    return dom.className.match(m) !== null;
  }
  
  function getIndex(dom) { return parseInt(dom.getAttribute('data-index'), 10); }
  
  get('todoapp').addEventListener("click", function (e) {
    var item;
    if(e.target) {
      if(hasClass(e.target, 'destroy')) {
        items.splice(getIndex(e.target), 1);
        update();
      }
      if(e.target.tagName === 'LABEL') {
        editItem = items[getIndex(e.target)];
        update();
      }
      if(e.target.id === 'toggle-all') {
        items.map(function (el) { return el.complete = e.target.checked; });
        update();
      }
      if(hasClass(e.target, 'toggle')) {
        item = items[getIndex(e.target)];
        item.complete = !item.complete;
        all_checked = true;
        items.map(function (el) { return all_checked = !el.complete ? false : undefined; });
        update();
      }
    }
  }
  );
  
  get('todoapp').addEventListener("keydown", function (e) {
    if(e.target) {
      if(hasClass(e.target, 'edit')) {
        if(e.which === 13) {
          items[getIndex(e.target)].value = e.target.value;
          editItem = false;
          update();
        }
        if(e.which === 27) {
          e.target.value = editItem.value;
          editItem = false;
          update();
        }
      }
    }
  }
  );
};

