// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScenario } from './model.js';
import { ResourcesPanel } from './ResourcesPanel.js';

afterEach(cleanup);

describe('ResourcesPanel', () => {
  it('uses the uploaded file name and filters files by the selected resource type', async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(
      <ResourcesPanel
        scenario={emptyScenario()}
        resources={[]}
        ready
        error={null}
        urls={{}}
        onRegister={onRegister}
        onDelete={vi.fn()}
      />,
    );

    const folder = screen.getByLabelText('素材の種類');
    const fileInput = screen.getByLabelText('ファイルを登録…') as HTMLInputElement;
    expect(fileInput.accept).toBe('.png,.jpg,.jpeg,.gif,.webp');

    const image = new File(['image'], 'original-scene.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [image] } });
    await vi.waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith('capture/original-scene.png', image);
    });

    fireEvent.change(folder, { target: { value: 'bgm/' } });
    expect(fileInput.accept).toBe('.mp3,.ogg,.wav,.m4a,.aac');
    const bgm = new File(['audio'], 'original-track.mp3', { type: 'audio/mpeg' });
    fireEvent.change(fileInput, { target: { files: [bgm] } });

    await vi.waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith('bgm/original-track.mp3', bgm);
    });

    fireEvent.change(folder, { target: { value: 'bgm/se/' } });
    expect(fileInput.accept).toBe('.mp3,.ogg,.wav,.m4a,.aac');
    const soundEffect = new File(['audio'], 'original-hit.wav', { type: 'audio/wav' });
    fireEvent.change(fileInput, { target: { files: [soundEffect] } });

    await vi.waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith('bgm/se/original-hit.wav', soundEffect);
    });

    fireEvent.change(folder, { target: { value: 'chara/' } });
    expect(fileInput.accept).toBe('.png,.jpg,.jpeg,.gif,.webp');
    const character = new File(['image'], 'original-character.webp', { type: 'image/webp' });
    fireEvent.change(fileInput, { target: { files: [character] } });

    await vi.waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith('chara/original-character.webp', character);
    });
  });

  it('lets a referenced image be registered at its scenario path', async () => {
    const scenario = emptyScenario();
    scenario.scenes[0]!.text = '![scene](scene01.png)';
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(
      <ResourcesPanel
        scenario={scenario}
        resources={[]}
        ready
        error={null}
        urls={{}}
        onRegister={onRegister}
        onDelete={vi.fn()}
      />,
    );

    const file = new File(['image'], 'scene01.png', { type: 'image/png' });
    const fileInput = screen.getAllByLabelText('素材を指定…')[0] as HTMLInputElement;
    expect(fileInput.accept).toBe('.png,.jpg,.jpeg,.gif,.webp');
    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await vi.waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith('capture/scene01.png', file);
    });
  });
});
