var vertex = `
		attribute vec2 uv;
		attribute vec2 position;
		varying vec2 vUv;
		void main() {
				vUv = uv;
				gl_Position = vec4(position, 0, 1);
		}
`;


// edit these values later for RGBA to use png
var fragment = `
		precision highp float;
		precision highp int;
		uniform sampler2D tWater;
		uniform sampler2D tFlow;
		uniform float uTime;
		varying vec2 vUv;
		uniform vec4 res;
		uniform vec2 img;

		vec2 centeredAspectRatio(vec2 uvs, vec2 factor){
				return uvs * factor - factor /2. + 0.5;
		}

		void main() {

			vec3 flow = texture2D(tFlow, vUv).rgb;

			vec2 uv = .5 * gl_FragCoord.xy / res.xy ;

			// vec2 uv = .5 * gl_FragCoord.xy / res.xy ;
			vec2 myUV = (uv - vec2(0.5))*res.zw + vec2(0.5);
			myUV -= flow.xy * (0.15 * 1.2);

			vec2 myUV2 = (uv - vec2(0.5))*res.zw + vec2(0.5);
			myUV2 -= flow.xy * (0.125 * 1.2);

			vec2 myUV3 = (uv - vec2(0.5))*res.zw + vec2(0.5);
			myUV3 -= flow.xy * (0.10 * 1.4);

			vec3 tex = texture2D(tWater, myUV).rgb;    // <<<<<< we want to use rgba for transparent (alpha)
			vec3 tex2 = texture2D(tWater, myUV2).rgb;
			vec3 tex3 = texture2D(tWater, myUV3).rgb;

			 gl_FragColor = vec4(tex.r, tex.g, tex.b, 0);
			// gl_FragColor = vec4(flow.r, flow.g, flow.b, 0);
            //gl_FragColor = texture2D(texture, uv);
		}
`;

 
{

  // img aspect raio
  var _size = [1.85, 1]; 
  
  // pass in { dpr: 2, alpha: true } for transparent
  var renderer = new ogl.Renderer({ dpr: 2, }); 

  var gl = renderer.gl;
  // display to html page
  document.body.appendChild(gl.canvas); 

  // Variable inputs to control flowmap
  var aspect = 1;
  var mouse = new ogl.Vec2(-1);
  var velocity = new ogl.Vec2();
  function resize() { 
    let a1, a2;
    
    // aspect ratio
    const imgSize = [window.innerWidth  , window.innerWidth * 0.8 * 0.5]; // <<<<<<<< img size /responsive off container/window width

    var imageAspect = imgSize[1] / imgSize[0];
    if (imgSize[1] / imgSize[0] < imageAspect) {
      a1 = 1;
      a2 = imgSize[1] / imgSize[0] / imageAspect;
    } else {
      a1 = (imgSize[0] / imgSize[1]) * imageAspect;
      a2 = 1;
    }
    mesh.program.uniforms.res.value = new ogl.Vec4(
      imgSize[0],
      imgSize[1],
      a1,
      a2
    );

    
    // renderer is like the img in canvas ( displaing the img - control size/aspect)
    renderer.setSize(imgSize[0], imgSize[1]);
    aspect = imgSize[0] / imgSize[1];
  }


  var flowmap = new ogl.Flowmap(gl, {
    falloff: 0.9, // << stamp/mouse effect size
    dissipation: 0.95,
    alpha: .05 });

  // Triangle that includes -1 to 1 range for 'position', and 0 to 1 range for 'uv'.
  var geometry = new ogl.Geometry(gl, {
    position: {
      size: 2,
      data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) } 
    });

  var texture = new ogl.Texture(gl, {
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR });

  var img = new Image();
  img.onload = () => texture.image = img;
  img.crossOrigin = "Anonymous";
  img.src = "https://res.cloudinary.com/drcax6kwu/image/upload/v1661480863/wilde%20assets/logo_for_code_small_2_mfjkvi.png";
  
  
  var a1, a2;
  var imageAspect = _size[1] / _size[0];
  if (window.innerHeight / window.innerWidth < imageAspect) {
    a1 = 1;
    a2 = window.innerHeight / window.innerWidth / imageAspect;
  } 
  else {
    a1 = window.innerWidth / window.innerHeight * imageAspect;
    a2 = 1;
  }

  var program = new ogl.Program(gl, {
    vertex,
    fragment,
    // transparent: true,
    uniforms: {
      uTime: { value: 0 },
      tWater: { value: texture },
      res: {
        value: new ogl.Vec4(window.innerWidth, window.innerHeight, a1, a2) },

      img: { value: new ogl.Vec2(_size[1], _size[0]) },
      // Note that the uniform is applied without using an object and value property
      // This is because the class alternates this texture between two render targets
      // and updates the value property after each render.
      tFlow: flowmap.uniform } 
    });


  var mesh = new ogl.Mesh(gl, { geometry, program });

  window.addEventListener("resize", resize, false); // update img width/ratio
  resize();

  // Create handlers to get mouse position and velocity
  var isTouchCapable = ("ontouchstart" in window);
  if (isTouchCapable) { // mobile/tablet - touchscreen
    window.addEventListener("touchstart", updateMouse, false);
    window.addEventListener("touchmove", updateMouse, { passive: false });
  } else { // desktop
    window.addEventListener("mousemove", updateMouse, false);
  }
  var lastTime;
  var lastMouse = new ogl.Vec2();
  
  function updateMouse(e) {
    e.preventDefault();

    if (e.changedTouches && e.changedTouches.length) {
      e.x = e.changedTouches[0].pageX;
      e.y = e.changedTouches[0].pageY;
    }
    if (e.x === undefined) {
      e.x = e.pageX;
      e.y = e.pageY;
    }
    // Get mouse value in 0 to 1 range, with y flipped
    mouse.set(e.x / gl.renderer.width, 1.0 - e.y / gl.renderer.height);
    // Calculate velocity
    if (!lastTime) {
      // First frame
      lastTime = performance.now();
      lastMouse.set(e.x, e.y);
    }

    var deltaX = e.x - lastMouse.x;
    var deltaY = e.y - lastMouse.y;

    lastMouse.set(e.x, e.y);

    var time = performance.now();

    // Avoid dividing by 0
    var delta = Math.max(10.4, time - lastTime);
    lastTime = time;
    velocity.x = deltaX / delta;
    velocity.y = deltaY / delta;
    // Flag update to prevent hanging velocity values when not moving
    velocity.needsUpdate = true;
  }
  requestAnimationFrame(update);

  function update(t) {
    requestAnimationFrame(update);
    // Reset velocity when mouse not moving
    if (!velocity.needsUpdate) {
      mouse.set(-1);
      velocity.set(0);
    }
    velocity.needsUpdate = false;
    // Update flowmap inputs
    flowmap.aspect = aspect;
    flowmap.mouse.copy(mouse);
    // Ease velocity input, slower when fading out
    flowmap.velocity.lerp(velocity, velocity.len ? 0.15 : 0.1);
    flowmap.update();
    program.uniforms.uTime.value = t * 0.01;
    renderer.render({ scene: mesh });
  }
}

 