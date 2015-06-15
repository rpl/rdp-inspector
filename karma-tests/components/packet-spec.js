/* See license.txt for terms of usage */
/* eslint-env jasmine */

define(function (require) {

"use strict";

var React = require("react");
var { TestUtils } = React.addons;

var { Packet } = require("components/packet");
const { TreeViewComponent } = require("reps/tree-view");

var ReactMatchers = require("karma-tests/custom-react-matchers");

describe("Packet", () => {
  beforeAll(() => {
    jasmine.addMatchers(ReactMatchers);
  });

  //TODO: currently skipped, until TreeView component is exported from firebug.sdk
  xit("contains a TreeView for props.data.packet only if props.showInlineDetails is true", () => {
    var packet;

    var data = {
      type: "receive",
      size: 0,
      id: 1,
      time: new Date("2015-06-09T16:48:50.162Z"),
      packet: {}
    };

    packet = TestUtils.renderIntoDocument(Packet({
      showInlineDetails: false,
      data: data
    }));

    //TODO: needs TreeView component exported from firebug.sdk
    expect(TreeViewComponent).toBeFoundInReactTree(packet, 0);

    packet = TestUtils.renderIntoDocument(Packet({
      showInlineDetails: true,
      data: data
    }));

    //TODO: needs TreeView component exported from firebug.sdk
    expect(TreeViewComponent).toBeFoundInReactTree(packet, 1);
  });

  describe("issues", () => {
    it("#44 - Long packet value breaks the view", () => {
      var data = {
        type: "receive",
        size: 0,
        id: 1,
        time: new Date("2015-06-09T16:48:50.162Z"),
        packet: {
          error: null,
          message: {
            "groupName": "",
            "columnNumber": 13,
            "lineNumber": 48,
            "workerType": "none",
            "level": "table",
            "counter": null,
            "arguments": [],
            "functionName": "onExecuteTest1"
          },
          "type": "consoleAPICall",
          "from": "server1.conn1.child1/consoleActor2"
        }
      };

      var packet = TestUtils.renderIntoDocument(Packet({
        showInlineDetails: false,
        data: data
      }));

      var el = React.findDOMNode(packet);

      expect(el).toBeDefined();

      // NOTE: prior the fix, a long "consoleAPICall" received packet
      // was wrongly turned into a "div.errorMessage"
      var errorMessage = el.querySelector(".errorMessage");
      expect(errorMessage).toEqual(null);
    });
  });

});

});
