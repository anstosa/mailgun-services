#!/bin/bash

cd /opt/app
npm install

#node index.js
node --inspect=0.0.0.0:9229 index.js

