'use client';

import { Edit2, DollarSign, Tag, Eye, Music, Mic, Waves } from 'lucide-react';
import { usePublishStore } from '@/store/publishStore';
import { cn } from '@/lib/utils';

export function PublishPreview() {
  const { 
    metadata, 
    pricing, 
    trackData,
    goToStep,
    getPlatformFee,
    getEstimatedEarnings 
  } = usePublishStore();

  // Format script preview
  const getScriptPreview = () => {
    if (!trackData?.script) return 'No script provided';
    const script = trackData.script;
    if (script.length <= 200) return script;
    return script.substring(0, 197) + '...';
  };

  // Get voice display name
  const getVoiceDisplay = () => {
    if (!trackData?.voice_config) return 'Not selected';
    const { provider, voice_id } = trackData.voice_config;
    return `${provider === 'openai' ? 'Standard' : 'Premium'} - ${voice_id}`;
  };

  // Get audio layers summary
  const getAudioLayers = () => {
    const layers = [];
    
    if (trackData?.voice_config) {
      layers.push('Voice narration');
    }
    
    if (trackData?.music_config?.url) {
      layers.push('Background music');
    }
    
    if (trackData?.frequency_config?.solfeggio) {
      const freq = trackData.frequency_config.solfeggio.frequency;
      layers.push(`Solfeggio ${freq}Hz`);
    }
    
    if (trackData?.frequency_config?.binaural) {
      const band = trackData.frequency_config.binaural.band;
      layers.push(`Binaural ${band}`);
    }
    
    return layers.length > 0 ? layers : ['Voice only'];
  };

  const activePrice = pricing.promotional && pricing.promotionalPrice 
    ? pricing.promotionalPrice 
    : pricing.price;

  return (
    <div className="space-y-6">
      {/* Metadata Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Track Information
          </h3>
          <button
            onClick={() => goToStep(1)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center"
          >
            <Edit2 className="w-4 h-4 mr-1" />
            Edit
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Title</label>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {metadata.title || 'Untitled Track'}
            </p>
          </div>
          
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Description</label>
            <p className="text-gray-700 dark:text-gray-300">
              {metadata.description || 'No description provided'}
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Category</label>
              <p className="text-gray-900 dark:text-white font-medium">
                {metadata.category || 'Not selected'}
              </p>
            </div>
            
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Visibility</label>
              <div className="flex items-center mt-1">
                <Eye className="w-4 h-4 mr-1 text-gray-400" />
                <span className="text-gray-900 dark:text-white capitalize">
                  {metadata.visibility || 'Not set'}
                </span>
              </div>
            </div>
          </div>
          
          {metadata.tags && metadata.tags.length > 0 && (
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 flex items-center mb-2">
                <Tag className="w-4 h-4 mr-1" />
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {metadata.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Script Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Script Preview
          </h3>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 italic">
            "{getScriptPreview()}"
          </p>
          {trackData?.script && trackData.script.length > 200 && (
            <p className="text-sm text-gray-500 mt-2">
              Full script: {trackData.script.length} characters
            </p>
          )}
        </div>
      </div>

      {/* Audio Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Audio Settings
          </h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-center">
            <Mic className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Voice</label>
              <p className="text-gray-900 dark:text-white">
                {getVoiceDisplay()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center">
            <Music className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Background Music</label>
              <p className="text-gray-900 dark:text-white">
                {trackData?.music_config?.url ? 'Selected' : 'None'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center">
            <Waves className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Audio Layers</label>
              <p className="text-gray-900 dark:text-white">
                {getAudioLayers().join(', ')}
              </p>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Output Format</label>
            <p className="text-gray-900 dark:text-white">
              {trackData?.output_config?.format?.toUpperCase() || 'MP3'} - {' '}
              {trackData?.output_config?.quality === 'high' ? 'High Quality' : 'Standard Quality'}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Summary */}
      {pricing.enableMarketplace && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Marketplace Listing
            </h3>
            <button
              onClick={() => goToStep(3)}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </button>
          </div>
          
          <div className="p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Sale Price:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {pricing.promotional && pricing.promotionalPrice ? (
                  <>
                    <span className="line-through text-gray-400 mr-2">
                      ${pricing.price?.toFixed(2)}
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      ${pricing.promotionalPrice.toFixed(2)}
                    </span>
                  </>
                ) : (
                  `$${pricing.price?.toFixed(2) || '0.00'}`
                )}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Platform Fee (15%):</span>
              <span className="text-red-600 dark:text-red-400">
                -${getPlatformFee().toFixed(2)}
              </span>
            </div>
            
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <span className="font-medium text-gray-900 dark:text-white">Your Earnings:</span>
              <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                ${getEstimatedEarnings().toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ready to Publish Message */}
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
          Ready to Publish!
        </h3>
        <p className="text-green-700 dark:text-green-300 mb-4">
          Your track is configured and ready to be rendered. Click "Publish" to start the rendering process.
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">
          Rendering typically takes 2-5 minutes depending on the length and complexity of your track.
        </p>
      </div>
    </div>
  );
}