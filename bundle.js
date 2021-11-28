/*
 * @Descripttion: 
 * @version: 
 * @Author: Charles Guo
 * @Date: 2021-11-28 12:12:12
 * @LastEditors: Charles Guo
 * @LastEditTime: 2021-11-28 14:05:56
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

function stepOne(filename) {
  // 读入文件
  const content = fs.readFileSync(filename, 'utf-8');
  const ast = parser.parse(content, {
    sourceType: 'module', // bebel 官方规定必须添加这个参数，不然无法识别ES module
  })
  const dependencies = {}
  // 便利AST 抽象语法树
  traverse(ast, {
    // 获取import引入的模块
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename);
      const newFile = './' + path.join(dirname, node.source.value);
      // 保存所依赖的模块
      dependencies[node.source.value] = newFile;
    }
  })
  // 通过@babel/core和@bebel/preset-env进行代码的转换
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"]
  })
  return {
    filename,
    dependencies,// 该文件所所依赖的模块集合(键值对存储)
    code // 转换后的代码
  }
}

function stepTwo(entry) {
  const entryModule = stepOne(entry)
  // 这个数组是核心 虽然现在只有一个元素
  const graphArray = [entryModule]
  for (let i = 0; i < graphArray.length; i++){
    const item = graphArray[i];
    const { dependencies } = item; //拿到文件所依赖的模块集合(键值对存储)
    for (const key in dependencies) {
      graphArray.push(
        stepOne(dependencies[key])
      ) // 关键代码 目的是将入口模块及其所有相关的模块放入数组
    }
  }
  // 接下来生成图谱
  const graph = {}
  graphArray.forEach(item => {
    graph[item.filename] = {
      dependencies: item.dependencies,
      code: item.code
    }
  })
  return graph
}

function stepThree(entry) {
  // 要先把对象转换为字符串 不然在下面的模板字符串中会默认调取对象的toString方法，参数变成[object,object]
  const graph = JSON.stringify(stepTwo(entry))
  return `
    (
      function(graph) {
        // require函数的本质是执行一个模块的代码，然后将相应变量挂载到exports对象上
        function require(module){
          // localRequire(relativePath) 的本质是拿到依赖包的exports变量
          function localRequire(relativePath){
            return require(graph[module].dependencies[relativePath]);
          }
          var exports = {};
          (function(require, exports, code) {
              eval(code)
          })(localRequire, exports, graph[module].code);
          return exports;
        }
        require('${entry}')
      }
    )(${graph})
  `
}
const code = stepThree('./src/index.js')
console.log(code)