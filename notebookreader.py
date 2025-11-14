import os, glob
import nbformat as nbformat

path= 'exercise_notebooks/'
idCellNeeded="IP101Week3Challenge1"
outputArray=[]

for filename in glob.glob(os.path.join(path, '*.ipynb')):
    pathToFile=os.path.join(os.getcwd(),filename)
    nb=nbformat.read(pathToFile,as_version=4)
    for cell in nb.cells:
        if cell.cell_type == 'code':
            if cell['metadata']['identifier']==idCellNeeded:
                outputArray.append(cell['source'])

print(outputArray)
