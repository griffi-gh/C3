function compileString(str) {
  let tokens = [];
  if(1){
    let tmp = '';
    let parseStack = [];
    let parseType = 'code';
    let tokenInfo = {};
    for (var i = 0; i < str.length; i++) {
      let char = str.charAt(i);
      switch(parseType) {
        case 'code':
          if(char=='"') {
            parseStack.push('code');
            parseType = 'str';
            tmp = '';
            continue;
          }
          break;
        case 'str':
          switch(char) {
            case '"':
              tokens.push({
                type: 'str',
                value: tmp
              })
              parseType = parseStack.pop();
              continue;
            default:
              tmp += char;
              break;
          }
      }
    }
  }
}