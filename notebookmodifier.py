baseIdentifier="IP101Week3Challenge"
# identifier

import nbformat as nbformat
for i in range(1,10):
    print(i)
    pathToFile="exercise_notebooks/conditionals_lab_v"+str(i)+".ipynb"
    nb= nbformat.read(pathToFile, as_version=4)
    print(nb)
    counter=1
    for cell in nb.cells:
        if cell.cell_type == 'code':
            cell['metadata']['identifier']= baseIdentifier+str(counter)
            counter+=1
    nbformat.write(nb,pathToFile)
