# CokeScript Language Specification

You can assume CokeScript is JavaScript with a Python like syntax. Some elements from Ruby might appear as well.

## Language basics

### Variable and scoping

Variable are simply declared without type

```python
a = 1
a = 2
def test()
  a = 3
```

Generates

```javascript
var a = 1;
a = 2;
function test() {
  var a = 3;
};
```

CokeScript notion of scope is by function. You can assign explicitly to a higher scope
by using an eplicit assign `:=`.

```python
a = 2
def test()
  a := 3
```

Generates

```javascript
var a = 2;
function test() {
  a = 3;
};
```

### Functions and lambda

All following forms are valid ways to declare functions

```python
a = def
  return 1

def function_name(a, b=1 + 1)
  return a + b

def(a, b=1 + 1)
  return a + b

def lambda_name(a, b) a + b

def(a, b) a + b
```

### Loops

Both Objects and Arrays are iterable using the same type of loop.

```python
for value in iterable
  console.log(value)

for index, value in iterable
  console.log(index, value)

i = 10
while i > 0
  i--
```

### Conditionnal

```python
if 1 == 2
  1
elseif 1 == 1
  2
else
  3

a = "Elephant" if weight > 1000 else "Mouse"
```

### Strings

```python
multi = "String can be 
multiline"

b = "#{multi}. And interpolate in a Ruby-like style"
```

### Try / Catch / Throw

Simply mirror JavaScript

```python
try
  something_wrong()
catch(e)
  console.log(e)
  throw new Error("Something else")
```

### Regular expression

Are identical to JavaScript

```python
"Abc".match(/abc/i)
```

## Virtual DOM

By adding 2 keywords and a special function declared with `dom` CokeScript
can generate virtual DOM objects using the [virtual-dom library](https://github.com/Matt-Esch/virtual-dom).
This quite useful and be used like (JSX from React)[http://facebook.github.io/react/docs/jsx-in-depth.html] to create
HTML components that can be updated with DOM diff.

```python
dom generateVirtualDom(links)
  <ul className="nav">
    for index, content in links
      <li className="cls#{ index }">
        =content
```

Generates

```javascript
function generateVirtualDom(links) {
  var __c1 = [];
  var __c2 = [];
    var _keys1 = Object.keys(links);
    for(var _index1 = 0; _index1 < _keys1.length; _index1++ ) {
      var index = _keys1[_index1];
      var content = links[_keys1[_index1]];
      var __c3 = [];
        __c3.push(String(content));
        __c2.push(h("li", {className:"cls#{ index }"}, __c3));
    };
    __c1.push(h("ul", {className:"nav"}, __c2));
  return __c1;
};
```