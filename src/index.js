//import React from "react";
//import ReactDOM from "react-dom";
//import "./scss/style.scss";


const $ = require('jquery')

import "./upload.js";
import "./websockets";
const { files } = require("./files.js");
import "./binds.js";

/*
class App extends React.Component {
  render() {
    return <div>Hello {this.props.name}</div>;
  }
}

var mountNode = document.getElementById("app");
ReactDOM.render(<App />, mountNode);
*/


console.log(files)

readAllInputSources()
resyncAllInputs()

websocketConnect()