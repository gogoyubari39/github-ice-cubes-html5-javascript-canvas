import tkinter as tk
from tkinter import messagebox

def test():
    messagebox.showinfo("テスト成功", "Python + Tkinterは正常に動いています！\n\nIce Cubesエディターもこの環境で動くはずです。")

root = tk.Tk()
root.title("Python Tkinter テスト")
root.geometry("400x200")

label = tk.Label(root, text="Python環境テスト中...\nボタンを押してください", font=("Arial", 12))
label.pack(pady=20)

button = tk.Button(root, text="テスト実行", command=test, font=("Arial", 12))
button.pack(pady=10)

