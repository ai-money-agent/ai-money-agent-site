import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareVideoRequest,
  videoCapability,
  validateHeyGenVideoRequest,
  createHeyGenVideo,
  getHeyGenVideo
} from '../lib/video.js';

test('legacy video preparation validates script, aspect ratio, and duration', () => {
  assert.deepEqual(prepareVideoRequest({script:'A short ad',aspectRatio:'9:16',durationSeconds:20}), {
    script:'A short ad',aspectRatio:'9:16',durationSeconds:20
  });
  assert.throws(() => prepareVideoRequest({script:'',durationSeconds:20}), /Script is required/);
  assert.throws(() => prepareVideoRequest({script:'valid',durationSeconds:10}), /supported video duration/);
});

test('paid video capability is unavailable until explicitly enabled with a server key', () => {
  assert.equal(videoCapability({apiKey:'secret'}).providerConnected,false);
  assert.equal(videoCapability({enabled:true}).providerConnected,false);
  assert.equal(videoCapability({enabled:true,apiKey:'secret'}).status,'ready');
});

test('HeyGen request is capped to a ten-second 480p clip', () => {
  assert.deepEqual(validateHeyGenVideoRequest({prompt:'Make a salon post ad'}), {
    prompt:'Make a salon post ad',durationSeconds:10,aspectRatio:'9:16',resolution:'480p'
  });
  assert.throws(() => validateHeyGenVideoRequest({prompt:'ad',durationSeconds:15}), /capped at 10 seconds/);
});

test('HeyGen creation sends a fixed endpoint, idempotency key, and bounded prompt', async () => {
  let request;
  const result = await createHeyGenVideo({
    prompt:'Create a vertical ad for a Canva salon post service.',
    apiKey:'server-secret',
    idempotencyKey:'project-123:reel-456',
    fetchImpl:async (url,init) => {
      request={url,init};
      return new Response(JSON.stringify({data:{video_id:'video_12345678',status:'pending'}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
  });
  assert.equal(result.videoId,'video_12345678');
  assert.equal(request.url,'https://api.heygen.com/v3/models/videos');
  assert.equal(request.init.headers['x-api-key'],'server-secret');
  assert.equal(request.init.headers['Idempotency-Key'],'project-123:reel-456');
  assert.equal(JSON.parse(request.init.body).duration,10);
  assert.equal(JSON.parse(request.init.body).resolution,'480p');
  await assert.rejects(() => createHeyGenVideo({
    prompt:'ad',apiKey:'secret',idempotencyKey:'bad key',
    fetchImpl:async()=>new Response(JSON.stringify({data:{video_id:'video_12345678'}}),{status:200})
  }), /valid idempotency key/);
});

test('HeyGen polling returns only HTTPS video URLs', async () => {
  let requestUrl;
  const result=await getHeyGenVideo({
    videoId:'video_12345678',apiKey:'server-secret',
    fetchImpl:async (url) => {
      requestUrl=url;
      return new Response(JSON.stringify({data:{video_id:'video_12345678',status:'completed',video_url:'https://cdn.example/video.mp4',duration:10}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
  });
  assert.equal(requestUrl,'https://api.heygen.com/v3/models/videos/video_12345678');
  assert.equal(result.status,'completed');
  assert.equal(result.videoUrl,'https://cdn.example/video.mp4');
  const unsafeUrl=await getHeyGenVideo({
    videoId:'video_12345678',apiKey:'secret',
    fetchImpl:async()=>new Response(JSON.stringify({data:{status:'completed',video_url:'http://unsafe.example/video.mp4'}}),{status:200,headers:{'Content-Type':'application/json'}})
  });
  assert.equal(unsafeUrl.videoUrl,null);
});
