// Tracks ONE declared fixture waitUntil D1 write; never an isolate census.
// A completed HTTP response is NOT proof that waitUntil finished.
const MARKER=/^[0-9a-f]{32}$/;
export function createApiBackgroundD1Barrier(){
  let marker=null,started=false,verified=false,tainted=false;
  function start(id){
    if(!MARKER.test(id??'')||started){tainted=true;return false;}
    marker=id;started=true;return true;
  }
  function complete(id,readback){
    if(!started||tainted||verified||id!==marker||
       readback!=='BACKGROUND_COMMITTED'){
      tainted=true;return false;
    }
    verified=true;return true;
  }
  function status(){
    return Object.freeze({
      expectedMarkerDeclared:started,backgroundPending:started&&!verified,
      declaredBackgroundD1ReadbackVerified:started&&verified&&!tainted,
      tainted,fixtureStopMayProceed:started&&verified&&!tainted,
      allWaitUntilJobsInstrumented:false,allWorkerIsolatesEnumerated:false,
      globalD1QuiescenceVerified:false,autoRestartAllowed:false,
      productionStopAuthorized:false
    });
  }
  return Object.freeze({start,complete,status});
}
