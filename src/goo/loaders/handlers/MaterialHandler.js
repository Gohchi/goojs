define([
	'goo/loaders/handlers/ConfigHandler',
	'goo/renderer/Material',
	'goo/renderer/Util',
	'goo/renderer/shaders/ShaderLib',
	'goo/util/rsvp',
	'goo/util/PromiseUtil',
	'goo/util/ObjectUtil'
], function(
	ConfigHandler,
	Material,
	Util,
	ShaderLib,
	RSVP,
	pu,
	_
) {
	function MaterialHandler() {
		ConfigHandler.apply(this, arguments);
		this._objects = {};
	}

	MaterialHandler.prototype = Object.create(ConfigHandler.prototype);
	ConfigHandler._registerClass('material', MaterialHandler);

	MaterialHandler.prototype._prepare = function(config) {
		if (config.blendState == null) {
			config.blendState = {};
		}
		_.defaults(config.blendState, {
			blending: 'NoBlending',
			blendEquation: 'AddEquation',
			blendSrc: 'SrcAlphaFactor',
			blendDst: 'OneMinusSrcAlphaFactor'
		});
		if (config.cullState == null) {
			config.cullState = {};
		}
		_.defaults(config.cullState, {
			enabled: true,
			cullFace: 'Back',
			frontFace: 'CCW'
		});
		if (config.depthState == null) {
			config.depthState = {};
		}
		_.defaults(config.depthState, {
			enabled: true,
			write: true
		});
		if (config.renderQueue == null) {
			config.renderQueue = -1;
		}
	};

	MaterialHandler.prototype._create = function(ref) {
		if (this._objects == null) {
			this._objects = {};
		}
		return this._objects[ref] = new Material(ref);
	};

	MaterialHandler.prototype.update = function(ref, config) {
		var that = this;

		this._prepare(config);
		if (this._objects[ref] == null) {
			this._create(ref);
			var object = this._objects[ref];

			return this._getShaderObject(config.shaderRef, config.wireframe).then(function(shader) {
				if (!shader) {
					console.warn('Unknown shader', config.shaderRef, '- not updating material', ref);
					return;
				}
				if (config.wireframe) {
					object.wireframe = config.wireframe;
				}
				if (config.wireframeColor) {
					object.wireframeColor = Util.clone(config.wireframeColor);
				}
				object.blendState = Util.clone(config.blendState);
				object.cullState = Util.clone(config.cullState);
				object.depthState = Util.clone(config.depthState);
				if (config.renderQueue === -1) {
					object.renderQueue = null;
				} else {
					object.renderQueue = config.renderQueue;
				}
				object.shader = shader;
				object.uniforms = {};
				for (var name in config.uniforms) {
					object.uniforms[name] = _.clone(config.uniforms[name]);
				}

				var promises = [];

				var updateTexture = function(textureType, textureRef) {
					return promises.push(that.getConfig(textureRef).then(function(textureConfig) {
						return that.updateObject(textureRef, textureConfig, that.options).then(function(texture) {
							return {
								type: textureType,
								ref: textureRef,
								texture: texture
							};
						});
					}));
				};
				for (var textureType in config.texturesMapping) {
					var textureRef = config.texturesMapping[textureType];
					updateTexture(textureType, textureRef);
				}
				if (promises.length) {
					return RSVP.all(promises).then(function(textures) {
						for (var i = 0; i < textures.length;  i++) {
							var texture = textures[i];
							if (texture.texture != null) {
								object.setTexture(texture.type, texture.texture);
							}
						}
						return object;
					}).then(null, function(err) {
						return console.error("Error loading textures: " + err);
					});
				} else {
					return object;
				}
			});
		} else {
			// Already loaded this material
			return pu.createDummyPromise(this._objects[ref]);
		}
	};

	MaterialHandler.prototype.remove = function(ref) {
		return delete this._objects[ref];
	};

	MaterialHandler.prototype._getShaderObject = function(ref, wireframe) {
		var that = this;
		if (wireframe) {
			var promise = new RSVP.Promise();
			var shader = Material.createShader(ShaderLib.simple);
			promise.resolve(shader);
			return promise;
		} else if (ref != null) {
			return this.getConfig(ref).then(function(config) {
				return that.updateObject(ref, config, that.options);
			});
		} else {
			var defaultShader = Material.createShader(ShaderLib.texturedLit, 'DefaultShader');
			return pu.createDummyPromise(defaultShader);
		}
	};

	return MaterialHandler;

});
