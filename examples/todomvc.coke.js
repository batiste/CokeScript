function todoMVC(list) {
  var __c1 = [];
  var __c2, __c3, __c4, __c5;
  __c2 = [];
    __c3 = [];
      __c4 = [];
        var __tmp = "todos"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
      __c3.push(virtual.h("h1", {}, __c4));
      
      __c3.push(virtual.h("input", {id: "new-todo", placeholder: "What needs to be done?", autofocus: true}, []));
      __c4 = [];
        
        __c4.push(virtual.h("input", {id: "toggle-all", type: "checkbox"}, []));
        __c5 = [];
          var __tmp = "Mark all as complete"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
        __c4.push(virtual.h("label", {for: "toggle-all"}, __c5));
        __c5 = [];
          var __keys1 = Object.keys(list);
          for(var __index1 = 0; __index1 < __keys1.length; __index1++) {
            var item = list[__keys1[__index1]];
            var __tmp = listItem(item); __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
          }
        __c4.push(virtual.h("ul", {id: "todo-list"}, __c5));
      __c3.push(virtual.h("section", {id: "main"}, __c4));
    __c2.push(virtual.h("header", {id: "header"}, __c3));
    var __tmp = footer(); __tmp instanceof Array ? (__c2 = __c2.concat(__tmp)) : __c2.push(String(__tmp));
  __c1.push(virtual.h("section", {id: "todoapp"}, __c2));
  return __c1;
}

function footer() {
  var __c1 = [];
  var __c2, __c3, __c4, __c5;
  __c2 = [];
    __c3 = [];
      __c4 = [];
        var __tmp = "2"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
      __c3.push(virtual.h("strong", {}, __c4));
      " item left";
    __c2.push(virtual.h("span", {id: "todo-count"}, __c3));
    __c3 = [];
      __c4 = [];
        __c5 = [];
          var __tmp = "All"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
        __c4.push(virtual.h("a", {href: "#/", className: "selected"}, __c5));
      __c3.push(virtual.h("li", {}, __c4));
      __c4 = [];
        __c5 = [];
          var __tmp = "Active"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
        __c4.push(virtual.h("a", {href: "#/active"}, __c5));
      __c3.push(virtual.h("li", {}, __c4));
      __c4 = [];
        __c5 = [];
          var __tmp = "Completed"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
        __c4.push(virtual.h("a", {href: "#/completed"}, __c5));
      __c3.push(virtual.h("li", {}, __c4));
      __c4 = [];
        var __tmp = "Clear completed"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
      __c3.push(virtual.h("button", {id: "clear-completed"}, __c4));
    __c2.push(virtual.h("ul", {id: "filters"}, __c3));
  __c1.push(virtual.h("footer", {id: "footer"}, __c2));
  return __c1;
}

function listItem(item) {
  var __c1 = [];
  var __c2, __c3, __c4;
  __c2 = [];
    __c3 = [];
      
      __c3.push(virtual.h("input", {className: "toggle", type: "checkbox", checked: ""}, []));
      __c4 = [];
        var __tmp = item; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
      __c3.push(virtual.h("label", {}, __c4));
      
      __c3.push(virtual.h("button", {className: "destroy"}, []));
      
      __c3.push(virtual.h("input", {className: "edit", value: "" + item + ""}, []));
    __c2.push(virtual.h("div", {className: "view"}, __c3));
  __c1.push(virtual.h("li", {className: "completed"}, __c2));
  return __c1;
}


window.onload = function () {
  var virtual_dom, real_dom, target;
  //virtual = require('virtual-dom')
  virtual_dom = virtual.h("div", todoMVC([1, 2, 3]));
  real_dom = virtual.create(virtual_dom);
  target = document.body;
  target.innerHTML = "";
  target.appendChild(real_dom);
  
  function get(id) {
    return document.getElementById(id);
  }
  
  get("new-todo").onkeypress = function (e) {
    return 1;
  };
};

