import tkinter as tk
from tkinter import messagebox

# tiles対応
TILES = {
    '.': '床', '#': '壁', 'P': 'プレイヤー', 
    'I': '氷', 'o': 'ドット'
}

class IceCubesEditor:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Ice Cubes Level Editor")
        self.grid_size = 20
        self.cell_size = 30
        self.map = [['.' for _ in range(self.grid_size)] for _ in range(self.grid_size)]
        self.current_tile = '.'
        self.create_ui()
    
    def create_ui(self):
        # ツールバー（タイル選択）
        toolbar = tk.Frame(self.root)
        toolbar.pack()
        for tile, label in TILES.items():
            btn = tk.Button(toolbar, text=label, command=lambda t=tile: self.set_tile(t))
            btn.pack(side=tk.LEFT)
        
        # グリッド
        self.canvas = tk.Canvas(self.root, width=self.grid_size*self.cell_size, 
                               height=self.grid_size*self.cell_size, bg='white')
        self.canvas.pack()
        self.canvas.bind("<Button-1>", self.on_click)
        self.draw_grid()
        
        # 保存ボタン
        tk.Button(self.root, text="マップ保存 (JS形式)", command=self.save_map).pack()
    
    def set_tile(self, tile):
        self.current_tile = tile
    
    def on_click(self, event):
        x = event.x // self.cell_size
        y = event.y // self.cell_size
        if 0 <= x < self.grid_size and 0 <= y < self.grid_size:
            self.map[y][x] = self.current_tile
            self.draw_grid()
    
    def draw_grid(self):
        self.canvas.delete("all")
        for y in range(self.grid_size):
            for x in range(self.grid_size):
                tile = self.map[y][x]
                color = {'#':'gray', 'I':'lightblue', 'o':'yellow', 'P':'red'}.get(tile, 'white')
                self.canvas.create_rectangle(x*self.cell_size, y*self.cell_size,
                                           (x+1)*self.cell_size, (y+1)*self.cell_size,
                                           fill=color, outline='black')
                self.canvas.create_text(x*self.cell_size + 15, y*self.cell_size + 15, text=tile)
    
    def save_map(self):
        # JS形式で出力
        js_map = ',\n'.join([f'    "{ "".join(row) }"' for row in self.map])
        print("{\n  name: \"New Stage\",\n  map: [\n" + js_map + "\n  ]\n}")
        messagebox.showinfo("保存", "コンソールにJS形式で出力しました！")

if __name__ == "__main__":
    editor = IceCubesEditor()
    editor.root.mainloop()