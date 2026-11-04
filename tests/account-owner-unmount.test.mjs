import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { loadTs } from './helpers/load-ts.mjs';

test('late step-up after unmount resolves false and in-flight cancellation settles', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url:'https://isolated-owner.test/'});
  const previous = new Map();
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const {useInlineOwnerStepUp} = loadTs('app/use-inline-owner-step-up.tsx', {'./authenticator-step-up': {__esModule:true,default:()=>null}});
  let authenticate;
  function Harness(){authenticate=useInlineOwnerStepUp().authenticate;return null;}
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('root'));
  try {
    await act(async()=>root.render(React.createElement(Harness)));
    let pending;
    await act(async()=>{pending=authenticate()});
    await act(async()=>root.unmount());
    assert.equal(await pending,false);
    const late=await Promise.race([authenticate(),new Promise(resolve=>setTimeout(()=>resolve('UNSETTLED'),20))]);
    assert.equal(late,false,'navigation before STEP_UP_REQUIRED must not leave a command pending forever');
  } finally {
    dom.window.close();
    for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
  }
});
