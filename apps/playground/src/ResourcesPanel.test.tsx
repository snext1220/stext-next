// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyScenario } from './model.js';
import { ResourcesPanel } from './ResourcesPanel.js';
import { validateResourceFile, type LocalResource } from './resources.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function resource(path: string, file: File): LocalResource {
  return {
    projectId: 'test',
    scenarioId: undefined,
    path,
    fileName: file.name,
    mimeType: file.type,
    blob: file,
    createdAt: '',
    updatedAt: '',
  };
}

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

  it.each([
    ['capture/', 'png', 'image/png'],
    ['bgm/', 'mp3', 'audio/mpeg'],
    ['bgm/se/', 'mp3', 'audio/mpeg'],
    ['chara/', 'webp', 'image/webp'],
  ])('registers multiple files under %s and links exact references', async (folder, ext, type) => {
    const scenario = emptyScenario();
    scenario.scenes[0]!.text = '![scene](scene.png) ![nested](nested/other.png) ![case](SCENE.png)';
    scenario.scenes[0]!.bgm = 'scene';
    scenario.scenes[0]!.se = 'scene';
    const onRegister = vi.fn().mockResolvedValue(undefined);
    const props = {
      scenario,
      resources: [] as LocalResource[],
      ready: true,
      error: null,
      urls: {},
      onRegister,
      onDelete: vi.fn(),
    };
    const { rerender } = render(<ResourcesPanel {...props} />);
    fireEvent.change(screen.getByLabelText('素材の種類'), { target: { value: folder } });
    const input = screen.getByLabelText('ファイルを登録…') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    const files = ['scene', 'other'].map((name) => new File(['data'], `${name}.${ext}`, { type }));
    fireEvent.change(input, { target: { files } });
    await vi.waitFor(() => {
      expect(screen.getByText('登録 2 件・スキップ 0 件・失敗 0 件')).toBeTruthy();
    });
    expect(onRegister.mock.calls).toEqual(files.map((file) => [`${folder}${file.name}`, file]));
    expect(input.value).toBe('');
    rerender(
      <ResourcesPanel
        {...props}
        resources={files.map((file) => resource(`${folder}${file.name}`, file))}
      />,
    );
    const matched = screen.getByText(`${folder}scene.${ext}`).closest('li')!;
    expect(matched.textContent).toContain(
      folder === 'chara/' ? `scene.${ext}` : `登録済み · scene.${ext}`,
    );
    expect(screen.getAllByText(`${folder}scene.${ext}`)).toHaveLength(1);
    expect(screen.getByText(`${folder}other.${ext}`).closest('li')!.textContent).not.toContain(
      '登録済み ·',
    );
    expect(screen.getByText('capture/nested/other.png').closest('li')!.textContent).toContain(
      '未登録',
    );
    expect(screen.getByText('capture/SCENE.png').closest('li')!.textContent).toContain('未登録');
  });

  it('confirms replacements and continues after skipping an existing file', async () => {
    const files = ['skip', 'replace', 'new'].map(
      (name) => new File(['image'], `${name}.png`, { type: 'image/png' }),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(
      <ResourcesPanel
        scenario={emptyScenario()}
        resources={files.slice(0, 2).map((file) => resource(`capture/${file.name}`, file))}
        ready
        error={null}
        urls={{}}
        onRegister={onRegister}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('ファイルを登録…'), { target: { files } });
    await vi.waitFor(() => {
      expect(screen.getByText('登録 2 件・スキップ 1 件・失敗 0 件')).toBeTruthy();
    });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onRegister.mock.calls).toEqual(
      files.slice(1).map((file) => [`capture/${file.name}`, file]),
    );
  });

  it('reports each failure and continues registering subsequent valid files', async () => {
    const onRegister = vi.fn(async (path: string, file: File) => {
      const error = validateResourceFile(path, file);
      if (error) throw new Error(error);
    });
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
    fireEvent.change(screen.getByLabelText('ファイルを登録…'), {
      target: {
        files: [
          new File([], 'empty.png', { type: 'image/png' }),
          new File(['audio'], 'wrong.mp3', { type: 'audio/mpeg' }),
          new File(['image'], 'valid.png', { type: 'image/png' }),
        ],
      },
    });
    await vi.waitFor(() => {
      expect(screen.getByText('登録 1 件・スキップ 0 件・失敗 2 件')).toBeTruthy();
    });
    expect(onRegister).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('alert').textContent).toContain('capture/empty.png: 空のファイル');
    expect(screen.getByRole('alert').textContent).toContain('capture/wrong.mp3: 画像は');
  });

  it('locks resource operations during sequential registration and permits selecting again', async () => {
    let finish: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onRegister = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined);
    const scenario = emptyScenario();
    scenario.scenes[0]!.text = '![image](old.png)';
    const old = new File(['old'], 'old.png', { type: 'image/png' });
    render(
      <ResourcesPanel
        scenario={scenario}
        resources={[resource('capture/old.png', old)]}
        ready
        error={null}
        urls={{}}
        onRegister={onRegister}
        onDelete={vi.fn()}
      />,
    );
    const input = screen.getByLabelText('ファイルを登録…') as HTMLInputElement;
    const files = ['first', 'second'].map(
      (name) => new File(['image'], `${name}.png`, { type: 'image/png' }),
    );
    fireEvent.change(input, { target: { files } });
    expect(screen.getByRole('status').textContent).toContain('（1/2）: capture/first.png');
    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(input.disabled).toBe(true);
    expect((screen.getByLabelText('素材の種類') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('差し替え…') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '削除' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { files } });
    expect(onRegister).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await vi.waitFor(() => expect(input.disabled).toBe(false));
    expect(onRegister).toHaveBeenCalledTimes(2);
    fireEvent.change(input, { target: { files: [files[0]] } });
    await vi.waitFor(() => expect(onRegister).toHaveBeenCalledTimes(3));
  });

  it('confirms duplicate destination names within the same selection', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
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
    fireEvent.change(screen.getByLabelText('ファイルを登録…'), {
      target: {
        files: [
          new File(['first'], 'same.png', { type: 'image/png' }),
          new File(['second'], 'same.png', { type: 'image/png' }),
        ],
      },
    });
    await vi.waitFor(() => {
      expect(screen.getByText('登録 1 件・スキップ 1 件・失敗 0 件')).toBeTruthy();
    });
    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('capture/same.png に登録した素材を差し替えますか？');
  });
});
