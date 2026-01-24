import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {CodeCellModel, isCodeCellModel} from '@jupyterlab/cells';
import {ICommandPalette, MainAreaWidget} from "@jupyterlab/apputils";
import {INotebookTracker, Notebook, NotebookActions, NotebookTracker} from '@jupyterlab/notebook'
import {Widget} from '@lumino/widgets';
import {IOutput} from '@jupyterlab/nbformat'
import {PageConfig} from '@jupyterlab/coreutils';
import {IRenderMimeRegistry} from "@jupyterlab/rendermime";

interface LLMResponse {
  LLMResponse: string;
}

const supportType="workedExample"

class LLMResponseWidget extends Widget{
  private widgetContainer: HTMLElement;
 // private _rendermime:IRenderMimeRegistry;
  //private renderer:IRenderMime.IRenderer;
  constructor() {
    super();
    //this.node.appendChild(renderer.node);
  //  this._rendermime= rendermime;
    this.addClass('LLM-responseWidget');
    this.widgetContainer = document.createElement('div');
    this.widgetContainer.classList.add('widget-container')
    //const introduction = document.createElement('p');
    //introduction.textContent = 'This is introductionary text, explaining the functionality of the service';
    //this.widgetContainer.appendChild(introduction);
    this.node.appendChild(this.widgetContainer);
    //this.renderer= this._rendermime.createRenderer('text/markdown');
    
  }
  clearPrompt(): void {

    if (this.widgetContainer && this.widgetContainer.parentNode){
      this.widgetContainer.parentNode.removeChild(this.widgetContainer)
    }

    this.widgetContainer = document.createElement('div');
    this.widgetContainer.classList.add('widget-container')
    this.node.appendChild(this.widgetContainer);
  }

  async updateWidget(execution_count:number,cellIdentifier:any,error: IOutput,sourceCode: String, hintCounter: number, taskDescriptionContent:String,rendermime: IRenderMimeRegistry): Promise<void>{
      const errorContainer=document.createElement('div');
      errorContainer.classList.add('error-container');

      const errorHeader = document.createElement('div');
      errorHeader.classList.add('error-errorHeader');
      errorContainer.appendChild(errorHeader)

      const llmrenderer= rendermime.createRenderer('text/markdown');
      llmrenderer.node.classList.add('error-LLMDescription');
      errorContainer.appendChild(llmrenderer.node);
      this.widgetContainer.appendChild(errorContainer);
     // errorContainer.appendChild(renderer.node).classList.add('error-LLMDescription');
    
      const executionCounter=execution_count.toString()
      const hintNumberDisplayed= hintCounter+1;
      const traceback = error['traceback']?.toString()??'UndefinedErrorValue';
      const errorName = error['ename']?.toString()??'UndefinedErrorValue';
      //const errorContainer= this.widgetContainer.querySelector('.error-container');
      //const errorHeader= this.widgetContainer.querySelector('.error-errorHeader');
      //errorHeader.innerHTML=`<span class="error-number">Cell [${errorData['execution_count']}]</span> ${errorData['errorName']}`;}
      errorHeader.innerHTML=`<h3>Hint ${hintNumberDisplayed.toString()}/3 Here's a similar example</h3>`;

      const waitingNodel = rendermime.createModel({
        data: { 'text/markdown': "#### Waiting for response from LLM..." }, trusted: true
      })
      await llmrenderer.renderModel(waitingNodel);
      try {
        const data = await askLLM(executionCounter,cellIdentifier,errorName,traceback,sourceCode, hintCounter, taskDescriptionContent) as LLMResponse;
        const resultModel = rendermime.createModel({
          data: { 'text/markdown': data['LLMResponse'] },
          trusted: true
        });
        await llmrenderer.renderModel(resultModel);
        await llmrenderer.renderModel(resultModel);
        requestAnimationFrame(() => {
          errorContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } catch (er: unknown) {
        const errorModel = rendermime.createModel({
            data: { 'text/markdown': "#### Error getting feedback" },
            trusted: true
        });
        await llmrenderer.renderModel(errorModel);
      
    }
      errorContainer.scrollIntoView({behavior:'smooth'});
    

    async function askLLM(executionCounter:String, cellIdentifier:any,errorName:String, traceback:String,sourceCode:String,hintCounter:number, taskDescriptionContent: String): Promise<any> {
      let token = PageConfig.getToken();
      let JupyterHubBaseUrl= PageConfig.getOption("JupyterHubBaseUrl");
      const HubLLMEndpoint = JupyterHubBaseUrl+'/services/askLLM/errorLog';
      const requestData = {'supportType':supportType,'cellIdentifier':cellIdentifier,executionCounter: executionCounter,errorName:errorName,traceback:traceback,sourceCode:sourceCode,hintCounter:hintCounter, "taskDescription":taskDescriptionContent};

      const response = await fetch(HubLLMEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
    }
  };

function activateWidget(app: JupyterFrontEnd, palette: ICommandPalette, notebookTracker: NotebookTracker, rendermime: IRenderMimeRegistry){

  const JupyterHubBaseUrl = PageConfig.getOption("JupyterHubBaseUrl");

  let widget: MainAreaWidget<LLMResponseWidget>;

  let lastExecutedCellId: string | null = null;

  notebookTracker.currentChanged.connect(() => {
    const notebookPanel = notebookTracker.currentWidget;
    if (notebookPanel) {
      console.log('Current notebook:', notebookPanel);
    }
  });
  /* Tracker is not working right now, might not be necessay
  if I want it to work tho, I will probably have to serialize the widget */
  const command: string = supportType+"open";
  app.commands.addCommand(command, {
    label: 'LLM Widget',
    execute: () => {
      if (!widget || widget.isDisposed) {
        setWidget()
      }
      if (!widget.isAttached) {
        // Attach the widget to the main work area if it's not there
        app.shell.add(widget, 'main',{ mode: 'split-right' });
      }
      // Activate the widget
      activateWidget()
        
      

  }});
  function setWidget(){
    const content = new LLMResponseWidget();
    widget = new MainAreaWidget({content});
    widget.id = 'LLMHelp-jupyterlab';
    widget.title.label = 'LLM Help';
    widget.title.closable = true;
  }
  function activateWidget(){
    app.shell.activateById(widget.id);
  }
  palette.addItem({ command, category: 'Tutorial' });

 function getTaskDescription(notebook:Notebook, taskDescriptionCellId:string){
  for (const cell of notebook.widgets){
    console.log(cell.model.getMetadata('identifier'))
    if (cell.model.getMetadata('identifier')==taskDescriptionCellId){
      const taskDescriptionJson= cell.model.toJSON()
      const taskDescriptionContent: String= String(taskDescriptionJson.source)
      return taskDescriptionContent
    }
  } return
  }



  NotebookActions.executed.connect((_, args) => {
    const { cell, notebook, success } = args;
    if (cell) {
      const cellModel = cell.model;
      if (isCodeCellModel(cellModel)){
        const cellIdentifier=cellModel.getMetadata('identifier')
        const assignedSupportType=cellModel.getMetadata('supportType')
        const hintCounter=cellModel.getMetadata("hintCounter")
        if (assignedSupportType==supportType){
        const taskDescriptionContent=getTaskDescription(notebook,cellIdentifier+"TaskDescription") ?? "";
        const cellJson = cell.model.toJSON();
        const sourceCode : String = String(cellJson.source);
        const execution_count=<number>cellJson.execution_count;
        if (execution_count){
        const outputCast = <CodeCellModel>cell.model;
        const outputs = outputCast.sharedModel.outputs;
        let outputArray=[];
        let errors: IOutput[] =[];
        for (let i=0;i<outputs.length;i++){
          if (outputs[i]['output_type']==='error'){
            errors.push(outputs[i]);
           }
          else {
             outputArray.push(outputs[i]['text']);}
        }
        if (!success) {
        if (hintCounter<3){
          cellModel.setMetadata("hintCounter",hintCounter+1);
        if (!widget || widget.isDisposed) {
          setWidget()
          activateWidget()
          app.shell.add(widget, 'main',{ mode: 'split-right' });
        }
        if (lastExecutedCellId!=cellIdentifier) {
          widget.content.clearPrompt();
        }
        lastExecutedCellId=cellIdentifier;
        widget.content.updateWidget(execution_count,cellIdentifier,errors[0],sourceCode,hintCounter,taskDescriptionContent,rendermime);}
         else {
          lastExecutedCellId=cellIdentifier;
          const traceback = errors[0]['traceback']?.toString()??'UndefinedErrorValue';
          const errorName = errors[0]['ename']?.toString()??'UndefinedErrorValue';
          logFailure(execution_count,cellIdentifier,errorName,traceback,sourceCode, hintCounter,taskDescriptionContent)
        }
        }
        if (success) {
          const output=JSON.stringify(outputArray);
          logSuccess(execution_count,cellIdentifier,output,sourceCode, hintCounter,taskDescriptionContent);
          console.log('Logging successful cell run');
        }
      }
    } else {}
  } else {
      console.error('Cell is undefined or null.');
    }
  }});

  async function logSuccess(executionCounter:number,cellIdentifier:any,outputArray:String,sourceCode:String, hintCounter:number,taskDescriptionContent:String ): Promise<any>{
    let token = PageConfig.getToken();
    const successEndpoint = JupyterHubBaseUrl+'/services/askLLM/successLog';
    const requestData = {'supportType':supportType,'cellIdentifier':cellIdentifier,"executionCounter": executionCounter,"outputArray":outputArray,"sourceCode":sourceCode,"hintCounter":hintCounter,"taskDescriptionContent":taskDescriptionContent};
    const response = await fetch(successEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
  });
  if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
  }
  async function logFailure(executionCounter:number,cellIdentifier:any, errorName:String, traceback:String,sourceCode:String, hintCounter:number,taskDescriptionContent:String): Promise<any> {
    let token = PageConfig.getToken();
    const HubLLMEndpoint = JupyterHubBaseUrl+'/services/askLLM/errorLog';
    const requestData = {'supportType':supportType,'cellIdentifier':cellIdentifier,"executionCounter": executionCounter,"errorName":errorName,"traceback":traceback,"sourceCode":sourceCode, "hintCounter":hintCounter,"taskDescriptionContent":taskDescriptionContent};

    const response = await fetch(HubLLMEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
  });

  if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}




}


 
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'workedExampleExtension:plugin',
  description: 'A JupyterLab LLM help extension.',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker, IRenderMimeRegistry],
  activate: activateWidget};
  

export default plugin;