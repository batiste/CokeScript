# CokeScript Language Specification

You can assume CokeScript is JavaScript with a Python like syntax. Some elements from ruby might appear as well.

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

