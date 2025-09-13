import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetManager } from './PresetManager';
import { DEFAULT_PRESETS } from './presets';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('PresetManager', () => {
  const mockOnLoad = vi.fn();
  
  const currentSettings = {
    solfeggio: { frequency: 528, volume_db: -16 },
    binaural: { band: 'theta' as const, carrier_frequency: 250, volume_db: -18 },
    gains: {
      master: 0,
      voice: -1,
      music: -10,
      solfeggio: -16,
      binaural: -18,
    },
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders default presets', () => {
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    DEFAULT_PRESETS.forEach(preset => {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
      if (preset.description) {
        expect(screen.getByText(preset.description)).toBeInTheDocument();
      }
    });
  });

  it('loads a default preset when clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const meditationPreset = screen.getByRole('button', { name: /meditation/i });
    await user.click(meditationPreset);

    const expectedPreset = DEFAULT_PRESETS.find(p => p.name === 'Meditation');
    expect(mockOnLoad).toHaveBeenCalledWith(expectedPreset?.settings);
  });

  it('shows save preset dialog when save button clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save current settings/i });
    await user.click(saveButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/preset name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('saves a custom preset', async () => {
    const user = userEvent.setup();
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    // Open save dialog
    const saveButton = screen.getByRole('button', { name: /save current settings/i });
    await user.click(saveButton);

    // Fill in preset details
    const nameInput = screen.getByLabelText(/preset name/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    
    await user.type(nameInput, 'My Custom Preset');
    await user.type(descriptionInput, 'A preset for deep focus');

    // Save the preset
    const confirmSaveButton = screen.getByRole('button', { name: /save preset/i });
    await user.click(confirmSaveButton);

    // Verify localStorage was called
    expect(localStorageMock.setItem).toHaveBeenCalled();
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(savedData).toContainEqual(
      expect.objectContaining({
        name: 'My Custom Preset',
        description: 'A preset for deep focus',
        isDefault: false,
        settings: currentSettings,
      })
    );
  });

  it('loads custom presets from localStorage', () => {
    const customPresets = [
      {
        id: 'custom-1',
        name: 'Night Mode',
        description: 'For evening meditation',
        isDefault: false,
        settings: currentSettings,
      },
    ];
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(customPresets));
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    expect(screen.getByText('Night Mode')).toBeInTheDocument();
    expect(screen.getByText('For evening meditation')).toBeInTheDocument();
  });

  it('deletes a custom preset', async () => {
    const user = userEvent.setup();
    
    const customPresets = [
      {
        id: 'custom-1',
        name: 'Night Mode',
        description: 'For evening meditation',
        isDefault: false,
        settings: currentSettings,
      },
    ];
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(customPresets));
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete night mode/i });
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    await user.click(confirmButton);

    // Verify localStorage was updated
    expect(localStorageMock.setItem).toHaveBeenCalled();
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(savedData).toHaveLength(0);
  });

  it('prevents deletion of default presets', () => {
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    // Default presets should not have delete buttons
    const meditationCard = screen.getByTestId('preset-card-meditation');
    const deleteButton = meditationCard.querySelector('button[aria-label*="delete"]');
    expect(deleteButton).not.toBeInTheDocument();
  });

  it('exports presets as JSON', async () => {
    const user = userEvent.setup();
    
    // Mock URL.createObjectURL and document.createElement
    const createObjectURLMock = vi.fn(() => 'blob:mock-url');
    const createElementMock = vi.fn(() => ({
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    }));
    
    global.URL.createObjectURL = createObjectURLMock;
    document.createElement = createElementMock as any;
    
    const customPresets = [
      {
        id: 'custom-1',
        name: 'Night Mode',
        description: 'For evening meditation',
        isDefault: false,
        settings: currentSettings,
      },
    ];
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(customPresets));
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const exportButton = screen.getByRole('button', { name: /export presets/i });
    await user.click(exportButton);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(createElementMock).toHaveBeenCalledWith('a');
  });

  it('imports presets from JSON file', async () => {
    const user = userEvent.setup();
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const importButton = screen.getByRole('button', { name: /import presets/i });
    const fileInput = screen.getByTestId('import-file-input');
    
    const file = new File(
      [JSON.stringify([{
        id: 'imported-1',
        name: 'Imported Preset',
        description: 'From another user',
        isDefault: false,
        settings: currentSettings,
      }])],
      'presets.json',
      { type: 'application/json' }
    );
    
    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  it('validates imported preset data', async () => {
    const user = userEvent.setup();
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const fileInput = screen.getByTestId('import-file-input');
    
    const invalidFile = new File(
      ['invalid json data'],
      'presets.json',
      { type: 'application/json' }
    );
    
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to import presets/i)).toBeInTheDocument();
    });
  });

  it('shows active preset indicator', () => {
    render(
      <PresetManager
        currentSettings={DEFAULT_PRESETS[0].settings}
        onLoad={mockOnLoad}
      />
    );

    const meditationCard = screen.getByTestId('preset-card-meditation');
    expect(meditationCard).toHaveClass('ring-2', 'ring-primary');
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('filters presets by search term', async () => {
    const user = userEvent.setup();
    
    const customPresets = [
      {
        id: 'custom-1',
        name: 'Night Mode',
        description: 'For evening meditation',
        isDefault: false,
        settings: currentSettings,
      },
      {
        id: 'custom-2',
        name: 'Focus Boost',
        description: 'Enhanced concentration',
        isDefault: false,
        settings: currentSettings,
      },
    ];
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(customPresets));
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search presets/i);
    await user.type(searchInput, 'focus');

    // Should show Focus Boost and Focus default preset
    expect(screen.getByText('Focus Boost')).toBeInTheDocument();
    expect(screen.getByText('Focus')).toBeInTheDocument();
    
    // Should hide Night Mode
    expect(screen.queryByText('Night Mode')).not.toBeInTheDocument();
  });

  it('handles duplicate preset names', async () => {
    const user = userEvent.setup();
    
    const customPresets = [
      {
        id: 'custom-1',
        name: 'My Preset',
        description: 'Original',
        isDefault: false,
        settings: currentSettings,
      },
    ];
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(customPresets));
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    // Try to save with duplicate name
    const saveButton = screen.getByRole('button', { name: /save current settings/i });
    await user.click(saveButton);

    const nameInput = screen.getByLabelText(/preset name/i);
    await user.type(nameInput, 'My Preset');

    const confirmSaveButton = screen.getByRole('button', { name: /save preset/i });
    await user.click(confirmSaveButton);

    // Should show error
    expect(screen.getByText(/A preset with this name already exists/i)).toBeInTheDocument();
  });

  it('limits preset name length', async () => {
    const user = userEvent.setup();
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save current settings/i });
    await user.click(saveButton);

    const nameInput = screen.getByLabelText(/preset name/i);
    expect(nameInput).toHaveAttribute('maxLength', '50');
  });

  it('shows preset count limit warning', () => {
    const customPresets = Array.from({ length: 20 }, (_, i) => ({
      id: `custom-${i}`,
      name: `Preset ${i}`,
      description: `Description ${i}`,
      isDefault: false,
      settings: currentSettings,
    }));
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(customPresets));
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    expect(screen.getByText(/Maximum preset limit reached/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save current settings/i })).toBeDisabled();
  });

  it('provides keyboard navigation for preset cards', async () => {
    const user = userEvent.setup();
    
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    // Tab to first preset
    await user.tab();
    const firstPreset = screen.getAllByRole('button')[0];
    expect(firstPreset).toHaveFocus();

    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}');
    const secondPreset = screen.getAllByRole('button')[1];
    expect(secondPreset).toHaveFocus();

    // Activate with Enter
    await user.keyboard('{Enter}');
    expect(mockOnLoad).toHaveBeenCalled();
  });

  it('displays presets in responsive grid layout', () => {
    render(
      <PresetManager
        currentSettings={currentSettings}
        onLoad={mockOnLoad}
      />
    );

    const container = screen.getByTestId('presets-grid');
    expect(container).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  });
});