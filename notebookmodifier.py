baseIdentifier="IP101Week8Challenge"
# identifier


####
#### UPDATE THIS FOR THE STUDY
#### 

import nbformat as nbformat
for i in range(1,10):
    print(i)
    pathToFile="exercise_notebooks/Exercise_Week1_Variation"+str(i)+".ipynb"
    nb= nbformat.read(pathToFile, as_version=4)
    print(nb)
    counter=1
    for cell in nb.cells:
        if cell.cell_type == 'code':
            cell['metadata']['identifier']= baseIdentifier+str(counter)
            counter+=1
    nbformat.write(nb,pathToFile)
