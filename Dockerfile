FROM quay.io/jupyter/minimal-notebook:2025-10-06

COPY ./customPromptExtension /extension/customPrompt
COPY ./genericSupportExtension /extension/genericSupport
COPY ./noSupportExtension /extension/noSupport
COPY ./personalizedSupportExtension /extension/personalizedSupport
COPY ./workedExampleExtension /extension/workedExampleExtension
COPY ./extensionManager /extension/extensionManager

USER root

COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g yarn

RUN cd /extension/extensionManager && \
    pip install .

RUN cd /extension/customPrompt && \
    pip install .

RUN cd /extension/genericSupport && \
    pip install .

RUN cd /extension/noSupport && \
    pip install . 

RUN cd /extension/personalizedSupport && \
    pip install .

RUN cd /extension/workedExampleExtension && \
    pip install .

RUN git clone https://github.com/KaiYakexi/jupy-cell-lock.git /jupy-cell-lock && \
    cd /jupy-cell-lock && \
    pip install .


USER ${NB_USER}