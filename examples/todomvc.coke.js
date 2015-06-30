
function todoMVC(list) {
  var __c1 = [];
  var __c2, __c3, __c4, __tmp, __c5;
  __c2 = [];
    __c3 = [];
      function test() {
        var __c3 = [];
        var __c4, __tmp;
        __c4 = [];
          __tmp = "test"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
        __c3.push(virtualDom.h("a", {attributes: {}}, __c4));
        return __c3;
      }
      __c4 = [];
        __tmp = "todos"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
      __c3.push(virtualDom.h("h1", {attributes: {}}, __c4));
      
      __c3.push(virtualDom.h("input", {attributes: {id: "new-todo", placeholder: "What needs to be done?", autofocus: true}}, []));
      __c4 = [];
        
        __c4.push(virtualDom.h("input", {attributes: {id: "toggle-all", type: "checkbox"}}, []));
        __c5 = [];
          __tmp = "Mark all as complete"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
        __c4.push(virtualDom.h("label", {attributes: {for: "toggle-all"}}, __c5));
        __c5 = [];
          var __keys1 = Object.keys(list);
          for(var __index1 = 0; __index1 < __keys1.length; __index1++) {
            var item = list[__keys1[__index1]];
            __tmp = listItem(item); __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
          }
        __c4.push(virtualDom.h("ul", {attributes: {id: "todo-list"}}, __c5));
      __c3.push(virtualDom.h("section", {attributes: {id: "main"}}, __c4));
    __c2.push(virtualDom.h("header", {attributes: {id: "header"}}, __c3));
    __tmp = footer(); __tmp instanceof Array ? (__c2 = __c2.concat(__tmp)) : __c2.push(String(__tmp));
  __c1.push(virtualDom.h("section", {attributes: {id: "todoapp"}}, __c2));
  return __c1;
}

function footer() {
  var __c1 = [];
  var __c2, __c3, __c4, __tmp, __c5;
  __c2 = [];
    __c3 = [];
      __c4 = [];
        __tmp = "2"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
      __c3.push(virtualDom.h("strong", {attributes: {}}, __c4));
      " item left";
    __c2.push(virtualDom.h("span", {attributes: {id: "todo-count"}}, __c3));
    __c3 = [];
      __c4 = [];
        __c5 = [];
          __tmp = "All"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
        __c4.push(virtualDom.h("a", {attributes: {href: "#/", class: "selected"}}, __c5));
      __c3.push(virtualDom.h("li", {attributes: {}}, __c4));
      __c4 = [];
        __c5 = [];
          __tmp = "Active"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
        __c4.push(virtualDom.h("a", {attributes: {href: "#/active"}}, __c5));
      __c3.push(virtualDom.h("li", {attributes: {}}, __c4));
      __c4 = [];
        __c5 = [];
          __tmp = "Completed"; __tmp instanceof Array ? (__c5 = __c5.concat(__tmp)) : __c5.push(String(__tmp));
        __c4.push(virtualDom.h("a", {attributes: {href: "#/completed"}}, __c5));
      __c3.push(virtualDom.h("li", {attributes: {}}, __c4));
      __c4 = [];
        __tmp = "Clear completed"; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
      __c3.push(virtualDom.h("button", {attributes: {id: "clear-completed"}}, __c4));
    __c2.push(virtualDom.h("ul", {attributes: {id: "filters"}}, __c3));
  __c1.push(virtualDom.h("footer", {attributes: {id: "footer"}}, __c2));
  return __c1;
}

function listItem(item) {
  var __c1 = [];
  var __c2, __c3, __c4, __tmp;
  __c2 = [];
    __c3 = [];
      
      __c3.push(virtualDom.h("input", {attributes: {class: "toggle", type: "checkbox", checked: ""}}, []));
      __c4 = [];
        __tmp = item; __tmp instanceof Array ? (__c4 = __c4.concat(__tmp)) : __c4.push(String(__tmp));
      __c3.push(virtualDom.h("label", {attributes: {}}, __c4));
      
      __c3.push(virtualDom.h("button", {attributes: {class: "destroy"}}, []));
      
      __c3.push(virtualDom.h("input", {attributes: {class: "edit", value: "" + item + ""}}, []));
    __c2.push(virtualDom.h("div", {attributes: {class: "view"}}, __c3));
  __c1.push(virtualDom.h("li", {attributes: {class: "completed"}}, __c2));
  return __c1;
}


window.onload = function () {
  var virtual_dom, real_dom, target;
  virtual_dom = virtualDom.h("div", todoMVC([1, 2, 3]));
  real_dom = virtualDom.create(virtual_dom);
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

