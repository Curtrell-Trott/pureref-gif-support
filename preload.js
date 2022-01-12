const {
  ipcRenderer, 
  contextBridge, 
  ipcMain
} = require('electron')


const interact = require('./interact.min.js')
let state = {
  mode: 'init', // 'init', 'standard', 'edit-video'
  editVideo:{

  },
  currentScale: 1,
  translate: {
    translateX: 0,
    translateY: 0
  },
  elements: [

  ]
}

let videoExample = {
  loopPairs: [[0, 119], [44, 56]], // can derive A, B, C & color coding from index
  activeLoopPair: 0
}
function closeEditVideo(){
  //state.editVideo.videoElement.removeEventListener('timeupdate', onPlayerProgress)
  state.mode = 'standard'
  updateScaleAndTranslate(state.editVideo.backupState.currentScale, state.editVideo.backupState.translate)
  state.editVideo.video.element.className = state.editVideo.backupState.elementClasses
  document.querySelector('#root').classList.remove('disableBorder')
  document.querySelector('#editVideoTools').classList.add('hide')
  state.editVideo = {}
}

function editVideo(video){
  console.log('video', video)
  state.mode = 'edit-video'
  document.querySelector('#root').style.cursor = ""
  state.editVideo.video = video
  state.editVideo.backupState = {
    currentScale: state.currentScale,
    translate: Object.assign({}, state.translate),
    elementClasses: video.element.className
  }
  updateScaleAndTranslate(1, {
    translateX: 0,
    translateY: 0
  })

  video.element.className = "editVideo"
  document.querySelector('#root').classList.add('disableBorder')
  document.querySelector('#editVideoTools').classList.remove('hide')
  
  document.getElementById('eventTrigger').dataset.changesliders = JSON.stringify(video.loopPairs[video.activeLoopPair])

  if(video.type =='youtube'){
    state.editVideo.videoElement = document.querySelector('.editVideo iframe').contentDocument.querySelector('video')
  } else{
    state.editVideo.videoElement = document.querySelector('.editVideo')
  }
  
  //state.editVideo.videoElement.addEventListener('timeupdate', onPlayerProgress)
  //
  
  console.log(video)
}

function onPlayerProgress(e){
  //am i editvideo?
  //  handle edit stuff
  let sliderPositions = document.querySelectorAll('.noUi-handle')
  let leftSliderPercent = Math.min(sliderPositions[0]['ariaValueText'], sliderPositions[1]['ariaValueText'])
  let rightSliderPercent = Math.max(sliderPositions[0]['ariaValueText'], sliderPositions[1]['ariaValueText'])
  //state.editVideo.video
  let sliderElement = document.querySelector('#slider')
  let currentTimePercent = (this.currentTime / this.duration * 100)

  if(this != state.editVideo.videoElement){

    let leftPercent = parseFloat(this.dataset.loopLeft)
    let rightPercent = parseFloat(this.dataset.loopRight)
    //console.log('im not edit video',leftPercent, rightPercent)
    if(leftPercent > currentTimePercent){
      this.currentTime = percentToCurrentTime(leftPercent, this.duration)
      currentTimePercent = (this.currentTime / this.duration * 100)
    }
    if(rightPercent < currentTimePercent){
      this.currentTime = percentToCurrentTime(leftPercent, this.duration)
      currentTimePercent = (this.currentTime / this.duration * 100)
    }
    return;
  } 

  //console.log('im edit video')

  state.editVideo.video.loopPairs[state.editVideo.video.activeLoopPair][0] = leftSliderPercent
  state.editVideo.video.loopPairs[state.editVideo.video.activeLoopPair][1] = rightSliderPercent
  this.dataset.loopLeft = leftSliderPercent
  this.dataset.loopRight = rightSliderPercent
  
  //console.log(state.editVideo.video.loopPairs, leftSliderPercent, rightSliderPercent)

  if(sliderElement.classList.contains('noUi-state-drag')){
      dragPercent = parseFloat(sliderElement.querySelector('.noUi-active')['ariaValueNow'])
      this.currentTime = percentToCurrentTime(dragPercent, this.duration)
  } else {
      if(leftSliderPercent > currentTimePercent){
          this.currentTime = percentToCurrentTime(leftSliderPercent, this.duration)
          currentTimePercent = (this.currentTime / this.duration * 100)
      }
      if(rightSliderPercent < currentTimePercent){
          //.noUi-state-drag
          if(sliderElement.classList.contains('noUi-state-drag')){
              this.currentTime = percentToCurrentTime(rightSliderPercent, this.duration)
          } else
              this.currentTime = percentToCurrentTime(leftSliderPercent, this.duration)
          
          currentTimePercent = (this.currentTime / this.duration * 100)
      }
  }
  let progressBarWidth = sliderElement.getBoundingClientRect().width // 10

  let progressBarTimePosition = progressBarWidth * (currentTimePercent / 100) // 4
  //    transform: translateX(41.4966%);
  document.getElementById('progressbar').style.transform = `translateX(${progressBarTimePosition}px)`
  //sliderElement.style.background = `linear-gradient(90deg, rgba(78,47,102,1) 0%, rgba(91,52,122,1) ${progressBarTimePosition}px, rgba(113,80,136,1) ${progressBarTimePosition}px, rgba(121,76,157,1) 100%)`
  
}
function percentToCurrentTime(percent, duration){
  if(percent >= 100) return duration
  if(percent <= 0) return 0
  let ct = (percent*duration)/100
  console.log("percentToCurrentTime", ct)
  return ct
}

function loadState(loadedState, filePath){
  // file stuff

  if(state.mode == 'init')
    init();
  document.getElementById('itemHolder').innerHTML = ''

  updateScaleAndTranslate(loadedState.currentScale, loadedState.translate)

  state.elements = []
  for(var i in loadedState.elements){
    addMediaWithPath(loadedState.elements[i].path, loadedState.elements[i].type, loadedState.elements[i])
  }
  ipcRenderer.send('loaded-state', filePath)
}

document.addEventListener('keydown', evt => {
  if(evt.key === 'Delete'){
    
    console.log('delete selected')
    deleteSelected()
  } else if (evt.key === 'v' && evt.ctrlKey) {
    ipcRenderer.send('handle-paste')
    console.log('Ctrl+V was pressed');
  }
});

function getSelected(){
  if(document.querySelector('.editVideo')) return {type:'edit-video'}
  let lastIndex = state.elements.length - 1
  if(!state.elements[lastIndex] || !state.elements[lastIndex].element.classList.contains('selectedItem')) return null
  
  return state.elements[lastIndex]
}
document.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  console.log(state)
  if(mouseObj.dragToggle) {
    mouseObj.dragToggle = false; 
    return;
  }
  
  ipcRenderer.send('show-context-menu', getSelected()?.type || "void")
})
let mouseObj = {
  initPos: null,
  initClientPos: null,
  dragToggle: false,
  //time dragging & distance dragged
}
document.addEventListener('mousedown', (e) => {
  mouseObj.initPos = {x: e.clientX, y: e.clientY}
  mouseObj.initClientPos = {x: e.screenX, y: e.screenY}
  ipcRenderer.send('record-window-size', window.innerHeight, window.innerHeight)
  mouseObj.dragToggle = false
})
document.addEventListener('mousemove', (e) => {
  if(e.buttons == 2){
      ipcRenderer.send('move-electron-window', e.screenX, e.screenY, mouseObj.initPos)
      mouseObj.dragToggle = true;
      
  }
})
document.addEventListener('mouseup', (e) => {
  if(mouseObj.dragToggle){
    distance = Math.sqrt(
                Math.pow(e.screenX - mouseObj.initClientPos.x, 2) 
                +
                Math.pow(e.screenY - mouseObj.initClientPos.y, 2) );

    if(distance < 4){ 
      mouseObj.dragToggle = false;
    }

  }
})
ipcRenderer.on('close-edit-video', (event, newState) =>{
  closeEditVideo()
})
ipcRenderer.on('edit-video', (event, newState) =>{
  editVideo(getSelected())
})
ipcRenderer.on('load-scene', (event, newState, filePath) =>{
  loadState(newState, filePath)
})
ipcRenderer.on('save-scene', (event, filePath) =>{
  var stateCopy = JSON.parse(JSON.stringify(state));
  for(var i = 0; i < stateCopy.elements.length; i++){
    //stateCopy.elements.push()
    delete stateCopy.elements[i].element;
  }
  console.log(stateCopy)
  ipcRenderer.send('save-scene', filePath, stateCopy)
})
ipcRenderer.on('clipboard', (event, msg) => {
  let payload = JSON.parse(msg);
  console.log(payload)
  if(/youtube.com\/.*v=([^\?]*)/.test(payload[payload.type])){
    addMediaWithPath(payload[payload.type], "youtube")
  }else
    addMediaWithPath(payload[payload.type])
})

function addMediaWithPath(path, type = 'img', loadedState={ x: 0, y: 0, width: null, height: null}){
  if(state.mode == 'init') init();
  document.querySelector('#welcome') && document.querySelector('#welcome').remove()
  let itemHolder = document.getElementById('itemHolder')

  let mediaElement = undefined
  if(type =='img'){
    mediaElement = document.createElement('img')
    mediaElement.src = path;
  } else if(type == 'video'){
    mediaElement = document.createElement('video')
    mediaElement.autoplay = true;
    mediaElement.loop = true;
    mediaElement.muted = true;
    
    let srcElement = document.createElement('source')
    srcElement.src = path;
    mediaElement.appendChild(srcElement)
  } else if(type == 'youtube') {
    //mediaElement = document.createElement('iframe')
    if(/youtube.com\/.*v=([^\?]*)/.test(path)){

      var code = extractYoutubeId(path)
      if(code == null) return;
      mediaElement = document.createElement('div')
      mediaElement.classList.add('youtubePlayer')
      mediaElement.classList.add('playerNeedsSetup')
      mediaElement.dataset.idcode = code
      
      mediaElement.style.width = (loadedState.width || 640) + "px";
      mediaElement.style.height = (loadedState.height || 360) + "px";

      //mediaElement.style.background = 'red'
      var iframeDiv = document.createElement('div')
      iframeDiv.classList.add('iframeDiv')
      mediaElement.appendChild(iframeDiv)
      document.getElementById('eventTrigger').dataset.youtubetrigger = Date.now()
      /*
      mediaElement.src = 
      `https://www.youtube.com/embed/${code}?` +//&autoplay=1` +
      `&controls=0&disablekb=1&enablejsapi=1&fs=0&loop=1` +
      `&origin=${window.location.href}`
      mediaElement.frameBorder = "0"
      mediaElement.allowFullscreen = false;
      */
    }
  } else{
    alert('unsupported media type')
    return;
  }
  mediaElement.classList.add('draggable')

  zIndex = state.elements.length;
  mediaElement.style.zIndex = zIndex
  mediaElement.dataset.zIndex = zIndex
  mediaElement.dataset.x = loadedState.x
  mediaElement.dataset.y = loadedState.y
  if(loadedState.width != null && loadedState.height != null){
    mediaElement.width = loadedState.width
    mediaElement.height = loadedState.height
  }
  let mediaObj = {
    path: path,
    type: type,
    element: mediaElement,
    width: loadedState.width,
    height: loadedState.height
  }
  if(type == 'youtube' || type == 'video'){
    mediaObj.loopPairs = loadedState.loopPairs || [[0, 100]] // 0% & 100% positions for loop
    mediaObj.activeLoopPair = loadState.activeLoopPair || 0
  }
  
  state.elements.push(mediaObj)
  if(type == 'video'){
    mediaObj.element.dataset.loopLeft = mediaObj.loopPairs[mediaObj.activeLoopPair][0]
    mediaObj.element.dataset.loopRight = mediaObj.loopPairs[mediaObj.activeLoopPair][1]
    mediaObj.element.addEventListener('timeupdate', onPlayerProgress)
  }

  itemHolder.appendChild(mediaElement)

  setTransformForElement(zIndex)
}

document.addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();
  // Todo check if file is valid
  
  
  for (const f of event.dataTransfer.files) {
      // Using the path attribute to get absolute file path
      console.log('File Path of dragged files: ', f.path, state)
      
      if(f.path.endsWith('.mp4')){
        addMediaWithPath(f.path, 'video')
      } else
        addMediaWithPath(f.path)
    }
});
function init(){
  document.documentElement.addEventListener('mousedown', (event) => {
    var target = event.target
    //console.log('click', target)
    
    if(target.id == 'root'){
      console.log('background click')
      clearAllSelected()
    }
  })
  state.mode = 'standard'
}

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});
function extractYoutubeId(path){
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
  var capture = path.match(regExp)//path.match(/v=([^\?]*)/);

  return capture[7]
}

function updateScaleAndTranslate(newScale, newTranslate){
  state.currentScale = newScale
  state.translate = newTranslate
  document.body.style.transform = `translate(${state.translate.translateX}px, ${state.translate.translateY}px) scale(${state.currentScale})`
  document.body.dataset.currentScale = state.currentScale
  document.body.dataset.translateX = state.translate.translateX
  document.body.dataset.translateY = state.translate.translateY

  //window.currentScale = state.currentScale;
}
let objPlayground = {hi:'yo'};
contextBridge.exposeInMainWorld('myAPI', {
  updateScaleAndTranslate: updateScaleAndTranslate,
  updateYoutubeOriginalSize: (idcode, w, h) => {
    for(var i in state.elements){
      if(state.elements[i].type == 'youtube' && extractYoutubeId(state.elements[i].path) == idcode){
        
        state.elements[i].width = state.elements[i].width || w;
        state.elements[i].height = state.elements[i].height || h;
        
        state.elements[i].element.style.width = state.elements[i].width
        state.elements[i].element.style.height = state.elements[i].height

        let videoElement = state.elements[i].element.querySelector('iframe').contentDocument.querySelector('video');
        videoElement.dataset.loopLeft = state.elements[i].loopPairs[state.elements[i].activeLoopPair][0]
        videoElement.dataset.loopRight = state.elements[i].loopPairs[state.elements[i].activeLoopPair][1]
        videoElement.addEventListener('timeupdate', onPlayerProgress)
        console.log(state.elements[i])
      }
    }
    
  },
  objPlayground: objPlayground

})

interact('.draggable')
  .draggable({
    listeners: { move: dragMoveListener },
    inertia: false
  }).on('tap', function (event) {
    var target = event.target
    console.log(objPlayground)
    handleSelected(target)
    //
    event.preventDefault()
  })

interact('.selectedItem').resizable({
  // resize from all edges and corners
  //allowFrom: '.selectedItem',
  edges: { left: true, right: true, bottom: true, top: true },
  ratio: 1,
  enabled: true,
  listeners: [{
    move (event) {
      var target = event.target
      //handleSelected(target, true)
      setTransformForElement(target.dataset.zIndex, event.deltaRect.left, event.deltaRect.top, event.rect.width, event.rect.height)
      forceRedraw()
    }
  }],
  modifiers: [
    interact.modifiers.aspectRatio({
      // make sure the width is always double the height
      ratio: 'preserve',
      // also restrict the size by nesting another modifier
    }),
    // minimum size
    interact.modifiers.restrictSize({
      min: { width: 10 }
    })
  ],
  inertia: true
}).draggable({
  listeners: { move: dragMoveListener },
  inertia: false
}).on('tap', function (event) {
  var target = event.target
  handleSelected(target)
  //
  event.preventDefault()
})

function deleteSelected(){
  if(state.elements.length == 0) return
  
  if(!state.elements[state.elements.length - 1].element.classList.contains('selectedItem')) return

  state.elements[state.elements.length - 1].element.remove();
  //delete state.elements[state.elements.length - 1].element
  state.elements.pop();
  clearAllSelected()
}

function clearAllSelected(){
  document.querySelectorAll('.selectedItem').forEach((elm)=>{
    elm.classList.remove('selectedItem')
    elm.classList.add('draggable')
  })
}
function handleSelected(target, dragging = false){
  /*
  var isSelected = target.classList.contains('selectedItem')
  
  if(!dragging){
    clearAllSelected()
  }
  if(!isSelected){
    if(dragging){
      clearAllSelected()
      
    }
    target.classList.remove('draggable')
    target.classList.add('selectedItem')
  }*/
  clearAllSelected()
  target.classList.remove('draggable')
  target.classList.add('selectedItem')
  
  if(state.elements.length > 1){
    let targetIndex = parseInt(target.dataset.zIndex);
    
    state.elements.push(state.elements.splice(targetIndex, 1)[0]);
    for(var i = targetIndex; i < state.elements.length; i++){ // i can start at targetIndex
      state.elements[i].element.style.zIndex = i;
      state.elements[i].element.dataset.zIndex = i;
    }
  }
}

function dragMoveListener (event) {
  var target = event.target
  handleSelected(target, true)
  setTransformForElement(target.dataset.zIndex, event.dx, event.dy)
  /*
  // keep the dragged position in the data-x/data-y attributes
  var x = (parseFloat(target.getAttribute('data-x')) || 0) + (event.dx / state.currentScale) //+ (state.translate.translateX / state.currentScale)
  var y = (parseFloat(target.getAttribute('data-y')) || 0) + (event.dy / state.currentScale) //+ (state.translate.translateY / state.currentScale)
  //x = x / state.currentScale
  //y = y / state.currentScale

  // translate the element
  target.style.transform = 'translate(' + x + 'px, ' + y + 'px)'

  // update the posiion attributes
  target.setAttribute('data-x', x)
  target.setAttribute('data-y', y)
  state.elements[target.dataset.zIndex].x = x
  state.elements[target.dataset.zIndex].y = y
  */
  forceRedraw()
}

function setTransformForElement(elementIndex, dx = 0, dy = 0, width = null, height = null){
  let elementObj = state.elements[elementIndex]
  let x = (parseFloat(elementObj.element.dataset.x) || 0) + (dx / state.currentScale)
  let y = (parseFloat(elementObj.element.dataset.y) || 0) + (dy / state.currentScale)
  elementObj.element.setAttribute('data-x', x)
  elementObj.element.setAttribute('data-y', y)
  elementObj.x = x
  elementObj.y = y

  if(width != null && height != null){
    elementObj.width = width / state.currentScale
    elementObj.height = height / state.currentScale
    elementObj.element.style.width = width / state.currentScale + 'px'
    elementObj.element.style.height = height / state.currentScale + 'px'
  }

  elementObj.element.style.transform = 'translate(' + x + 'px, ' + y + 'px)'
}

function forceRedraw(){
  if(document.body.parentElement.style.backgroundColor == ''){
    document.body.parentElement.style.backgroundColor = '#04040400'
  } else{
    document.body.parentElement.style.backgroundColor = ''
  }
}


window.addEventListener('load', (event) => {
  console.log('page is fully loaded');
  ipcRenderer.send('ready')
});
