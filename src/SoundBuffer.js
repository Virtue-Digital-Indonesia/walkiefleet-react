class SoundBuffer {
  constructor(ctx, sampleRate, framesCount, prefetchCount, debug) {
    this.ctx = ctx
    this.sampleRate = sampleRate
    this.framesCount = framesCount
    this.prefetchCount = prefetchCount
    this.debug = debug
    this.chunks = []
    this.isPlaying = false
    this.startTime = 0
    this.lastChunkOffset = 0
  }
  createChunk(chunk) {
    var audioBuffer = this.ctx.createBuffer(1, chunk.length, this.sampleRate)
    audioBuffer.getChannelData(0).set(chunk)
    var source = this.ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.ctx.destination)
    source.onended = () => {
      this.chunks.splice(this.chunks.indexOf(source), 1)
      if (this.chunks.length === 0) {
        this.isPlaying = false
        this.startTime = 0
        this.lastChunkOffset = 0
      }
    }
    return source
  }
  log(data) {
    if (this.debug) {
      console.log(new Date().toUTCString() + ' : ' + data)
    }
  }
  addChunk(data) {
    if (this.isPlaying && this.chunks.length > this.framesCount) {
      this.log('chunk discarded')
      return // throw away
    } else if (this.isPlaying && this.chunks.length <= this.framesCount) {
      // schedule & add right now
      this.log('chunk accepted')
      let chunk = this.createChunk(data)
      chunk.start(this.startTime + this.lastChunkOffset)
      this.lastChunkOffset += chunk.buffer.duration
      this.chunks.push(chunk)
    } else if (this.chunks.length < this.prefetchCount && !this.isPlaying) {
      // add & don't schedule
      this.log('chunk queued')
      let chunk = this.createChunk(data)
      this.chunks.push(chunk)
    } else {
      // add & schedule entire buffer
      this.log('queued chunks scheduled')
      this.isPlaying = true
      let chunk = this.createChunk(data)
      this.chunks.push(chunk)
      this.startTime = this.ctx.currentTime
      this.lastChunkOffset = 0
      for (let i = 0; i < this.chunks.length; i++) {
        let chunk = this.chunks[i]
        chunk.start(this.startTime + this.lastChunkOffset)
        this.lastChunkOffset += chunk.buffer.duration
      }
    }
  }
}

export default SoundBuffer